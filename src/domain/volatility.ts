import { clamp, toYears } from './math'
import type { MarketParams, OptionLeg, StrategyLeg, VolModel } from './types'

export const DEFAULT_VOL_MODEL: VolModel = {
  kind: 'flat',
  skew: -0.25,
  curvature: 0.8,
}

export const MIN_MODEL_IV = 0.01
export const MAX_MODEL_IV = 3

export function optionLegs(legs: StrategyLeg[]): OptionLeg[] {
  return legs.filter((leg): leg is OptionLeg => leg.kind === 'option')
}

export function referenceStrike(legs: StrategyLeg[], market: MarketParams): number {
  const options = optionLegs(legs)
  const totalQuantity = options.reduce((total, leg) => total + leg.quantity, 0)
  if (totalQuantity <= 0) return market.spot

  return (
    options.reduce((total, leg) => total + leg.strike * leg.quantity, 0) /
    totalQuantity
  )
}

export function hasMultipleExpiries(legs: StrategyLeg[]): boolean {
  const expiries = [...new Set(optionLegs(legs).map((leg) => roundExpiry(leg.dteDays)))]
  return expiries.length > 1
}

export function maxDteDays(legs: StrategyLeg[], market: MarketParams): number {
  const expiries = optionLegs(legs).map((leg) => leg.dteDays)
  return Math.max(market.dteDays, ...expiries, 0.25)
}

export function forwardPrice(
  spot: number,
  market: Pick<MarketParams, 'rate' | 'dividendYield'>,
  dteDays: number,
): number {
  return spot * Math.exp((market.rate - market.dividendYield) * toYears(dteDays))
}

export function logMoneyness(
  strike: number,
  spot: number,
  market: Pick<MarketParams, 'rate' | 'dividendYield'>,
  dteDays: number,
): number {
  const forward = forwardPrice(spot, market, dteDays)
  return Math.log(strike / Math.max(forward, 0.000001))
}

export function resolveLegIv({
  leg,
  market,
  spot,
  dteDays,
  atmIv,
  volModel = DEFAULT_VOL_MODEL,
}: {
  leg: OptionLeg
  market: MarketParams
  spot: number
  dteDays: number
  atmIv: number
  volModel?: VolModel
}): number {
  if (volModel.kind === 'flat') return leg.iv

  const logKF = logMoneyness(leg.strike, spot, market, dteDays)
  const curvature = volModel.kind === 'skew-smile' ? volModel.curvature : 0
  const modeledIv = atmIv + volModel.skew * logKF + curvature * logKF ** 2
  return clamp(modeledIv, MIN_MODEL_IV, MAX_MODEL_IV)
}

function roundExpiry(value: number): number {
  return Math.round(value * 1000000) / 1000000
}
