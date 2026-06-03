import { clamp, DAYS_PER_YEAR, MIN_VOL } from './math'
import type { MarketParams, PricePathConfig, PricePathPoint } from './types'

const MIN_SPOT = 0.000001
export const MAX_PATH_STEPS = 252

export function defaultPathConfigForMarket(market: MarketParams): PricePathConfig {
  return {
    enabled: false,
    model: 'gbm',
    horizonDays: market.dteDays,
    steps: clampInteger(Math.round(market.dteDays), 1, MAX_PATH_STEPS),
    seed: 42,
    drift: 0,
    volatility: market.iv,
    jumpIntensity: 1,
    jumpMean: -0.02,
    jumpVolatility: 0.04,
    bootstrapReturns: '-0.01, 0.006, 0.003, -0.004, 0.012, -0.007',
    ivMode: 'constant',
    terminalIv: market.iv,
  }
}

export function buildPricePath(
  market: MarketParams,
  config: PricePathConfig,
  horizonLimitDays = market.dteDays,
): PricePathPoint[] {
  const steps = clampInteger(config.steps, 1, MAX_PATH_STEPS)
  const horizonDays = clamp(config.horizonDays, 0, Math.max(horizonLimitDays, 0))
  const dtYears = horizonDays / steps / DAYS_PER_YEAR
  const rng = seededRandom(config.seed)
  const normal = normalSampler(rng)
  const bootstrapReturns = parseBootstrapReturns(config.bootstrapReturns)
  const points: PricePathPoint[] = []
  let spot = Math.max(market.spot, MIN_SPOT)

  for (let step = 0; step <= steps; step += 1) {
    const elapsedDays = (horizonDays * step) / steps
    points.push({
      step,
      elapsedDays,
      spot,
      atmIv: pathIv(market.iv, config, step / steps),
    })

    if (step === steps) break

    if (config.model === 'historical-bootstrap') {
      const sampledReturn =
        bootstrapReturns.length > 0
          ? bootstrapReturns[Math.floor(rng() * bootstrapReturns.length)]
          : 0
      spot = Math.max(spot * Math.max(1 + sampledReturn, MIN_SPOT), MIN_SPOT)
      continue
    }

    const volatility = Math.max(config.volatility, MIN_VOL)
    let logReturn =
      (config.drift - 0.5 * volatility ** 2) * dtYears +
      volatility * Math.sqrt(dtYears) * normal()

    if (config.model === 'jump-diffusion') {
      const jumpCount = poisson(Math.max(config.jumpIntensity, 0) * dtYears, rng)
      const jumpVolatility = Math.max(config.jumpVolatility, 0)
      for (let jumpIndex = 0; jumpIndex < jumpCount; jumpIndex += 1) {
        logReturn += config.jumpMean + jumpVolatility * normal()
      }
    }

    spot = Math.max(spot * Math.exp(logReturn), MIN_SPOT)
  }

  return points
}

export function parseBootstrapReturns(input: string): number[] {
  return input
    .split(/[,\s]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map(parseReturnToken)
    .filter((value) => Number.isFinite(value))
}

function pathIv(
  startIv: number,
  config: PricePathConfig,
  progress: number,
): number {
  if (config.ivMode === 'constant') return startIv
  return clamp(startIv + (config.terminalIv - startIv) * progress, MIN_VOL, 3)
}

function parseReturnToken(token: string): number {
  if (token.endsWith('%')) {
    return Number(token.slice(0, -1)) / 100
  }
  return Number(token)
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.round(value), min), max)
}

function seededRandom(seed: number): () => number {
  let state = normalizeSeed(seed)
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function normalizeSeed(seed: number): number {
  const normalized = Math.trunc(Math.abs(Number.isFinite(seed) ? seed : 1))
  return normalized === 0 ? 1 : normalized
}

function normalSampler(rng: () => number): () => number {
  let spare: number | null = null

  return () => {
    if (spare !== null) {
      const value = spare
      spare = null
      return value
    }

    let first = 0
    let second = 0
    while (first <= Number.EPSILON) first = rng()
    while (second <= Number.EPSILON) second = rng()
    const radius = Math.sqrt(-2 * Math.log(first))
    const angle = 2 * Math.PI * second
    spare = radius * Math.sin(angle)
    return radius * Math.cos(angle)
  }
}

function poisson(lambda: number, rng: () => number): number {
  if (lambda <= 0) return 0
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normalSampler(rng)()))

  const threshold = Math.exp(-lambda)
  let product = 1
  let count = 0
  do {
    count += 1
    product *= rng()
  } while (product > threshold)
  return count - 1
}
