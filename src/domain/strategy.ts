import { bsmGreeks } from './bsm'
import { linspace, roundTo } from './math'
import type {
  AxisMode,
  DisplayMode,
  EvaluatedStrategy,
  EvaluationOverrides,
  GreekMetric,
  GreekValues,
  MarketParams,
  OptionLeg,
  RawGreekValues,
  StrategyLeg,
  StrategySummary,
} from './types'

function sideSign(side: StrategyLeg['side']): number {
  return side === 'long' ? 1 : -1
}

function emptyPractical(): GreekValues {
  return {
    price: 0,
    delta: 0,
    gamma: 0,
    theta: 0,
    vega: 0,
    vanna: 0,
    charm: 0,
    volga: 0,
  }
}

function emptyRaw(): RawGreekValues {
  return {
    ...emptyPractical(),
    thetaPerYear: 0,
    vegaPerVol: 0,
    vannaPerVol: 0,
    charmPerYear: 0,
    volgaPerVol: 0,
  }
}

function addScaledGreek(
  target: GreekValues,
  source: GreekValues,
  scale: number,
): void {
  target.price += source.price * scale
  target.delta += source.delta * scale
  target.gamma += source.gamma * scale
  target.theta += source.theta * scale
  target.vega += source.vega * scale
  target.vanna += source.vanna * scale
  target.charm += source.charm * scale
  target.volga += source.volga * scale
}

function addScaledRaw(
  target: RawGreekValues,
  source: RawGreekValues,
  scale: number,
): void {
  addScaledGreek(target, source, scale)
  target.thetaPerYear += source.thetaPerYear * scale
  target.vegaPerVol += source.vegaPerVol * scale
  target.vannaPerVol += source.vannaPerVol * scale
  target.charmPerYear += source.charmPerYear * scale
  target.volgaPerVol += source.volgaPerVol * scale
}

export function evaluateStrategy(
  legs: StrategyLeg[],
  market: MarketParams,
  overrides?: EvaluationOverrides,
): EvaluatedStrategy {
  const practical = emptyPractical()
  const raw = emptyRaw()

  for (const leg of legs) {
    const scale = sideSign(leg.side) * leg.quantity * leg.multiplier

    if (leg.kind === 'underlying') {
      practical.price += market.spot * scale
      practical.delta += scale
      raw.price += market.spot * scale
      raw.delta += scale
      continue
    }

    const legDteDays =
      overrides?.dteDays ??
      Math.max(leg.dteDays - (overrides?.elapsedDays ?? 0), 0.25)

    const optionGreeks = bsmGreeks({
      type: leg.type,
      spot: market.spot,
      strike: leg.strike,
      dteDays: legDteDays,
      iv: overrides?.iv ?? leg.iv,
      rate: market.rate,
      dividendYield: market.dividendYield,
    })
    addScaledGreek(practical, optionGreeks, scale)
    addScaledRaw(raw, optionGreeks, scale)
  }

  return { practical, raw }
}

export function selectMetricValue(
  evaluation: EvaluatedStrategy,
  metric: GreekMetric,
  displayMode: DisplayMode,
  spot: number,
  initialPrice: number,
): { value: number; rawValue: number } {
  if (metric === 'pnl') {
    const pnl = evaluation.practical.price - initialPrice
    return { value: pnl, rawValue: pnl }
  }

  if (displayMode === 'raw') {
    const rawValue = rawMetric(evaluation.raw, metric)
    return { value: rawValue, rawValue }
  }

  const practicalValue = evaluation.practical[metric]
  if (displayMode === 'pnl-contribution') {
    return {
      value: pnlContribution(metric, practicalValue, spot),
      rawValue: practicalValue,
    }
  }

  return { value: practicalValue, rawValue: practicalValue }
}

function rawMetric(raw: RawGreekValues, metric: GreekMetric): number {
  if (metric === 'pnl') return 0
  if (metric === 'theta') return raw.thetaPerYear
  if (metric === 'vega') return raw.vegaPerVol
  if (metric === 'vanna') return raw.vannaPerVol
  if (metric === 'charm') return raw.charmPerYear
  if (metric === 'volga') return raw.volgaPerVol
  return raw[metric]
}

function pnlContribution(
  metric: GreekMetric,
  practicalValue: number,
  spot: number,
): number {
  const onePercentMove = spot * 0.01
  if (metric === 'delta') return practicalValue * onePercentMove
  if (metric === 'gamma') return 0.5 * practicalValue * onePercentMove ** 2
  if (metric === 'vanna') return practicalValue * onePercentMove
  if (metric === 'charm') return practicalValue * onePercentMove
  if (metric === 'volga') return 0.5 * practicalValue
  return practicalValue
}

export function payoffAtExpiry(legs: StrategyLeg[], spot: number): number {
  return legs.reduce((total, leg) => {
    const scale = sideSign(leg.side) * leg.quantity * leg.multiplier
    if (leg.kind === 'underlying') return total + spot * scale
    const intrinsic =
      leg.type === 'call'
        ? Math.max(spot - leg.strike, 0)
        : Math.max(leg.strike - spot, 0)
    return total + intrinsic * scale
  }, 0)
}

function tailSlope(legs: StrategyLeg[]): number {
  return legs.reduce((total, leg) => {
    const scale = sideSign(leg.side) * leg.quantity * leg.multiplier
    if (leg.kind === 'underlying') return total + scale
    if (leg.type === 'call') return total + scale
    return total
  }, 0)
}

export function summarizeStrategy(
  legs: StrategyLeg[],
  market: MarketParams,
): StrategySummary {
  const current = evaluateStrategy(legs, market)
  const netPremium = current.practical.price
  const strikes = legs
    .filter((leg): leg is OptionLeg => leg.kind === 'option')
    .map((leg) => leg.strike)
  const maxStrike = Math.max(market.spot, ...strikes, 1)
  const payoffSpots = [0, ...strikes, ...linspace(maxStrike * 0.25, maxStrike * 2, 400)]
  const pnlAtExpiry = payoffSpots.map((spot) => payoffAtExpiry(legs, spot) - netPremium)
  const highSlope = tailSlope(legs)
  const finiteMax = Math.max(...pnlAtExpiry)
  const finiteMin = Math.min(...pnlAtExpiry)

  const breakevens: number[] = []
  for (let index = 1; index < payoffSpots.length; index += 1) {
    const prev = pnlAtExpiry[index - 1]
    const curr = pnlAtExpiry[index]
    if (prev === 0) {
      breakevens.push(payoffSpots[index - 1])
      continue
    }
    if (prev * curr < 0) {
      const left = payoffSpots[index - 1]
      const right = payoffSpots[index]
      const weight = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr))
      breakevens.push(left + (right - left) * weight)
    }
  }

  const sensitivitySamples = linspace(market.spot * 0.7, market.spot * 1.3, 121)
  const sensitiveSpot = sensitivitySamples.reduce((bestSpot, spot) => {
    const bestGamma = Math.abs(
      evaluateStrategy(legs, { ...market, spot: bestSpot }).practical.gamma,
    )
    const gamma = Math.abs(
      evaluateStrategy(legs, { ...market, spot }).practical.gamma,
    )
    return gamma > bestGamma ? spot : bestSpot
  }, market.spot)

  const gamma = current.practical.gamma
  const vega = current.practical.vega

  return {
    netPremium,
    maxProfit: highSlope > 0 ? 'Unlimited' : roundTo(finiteMax, 2),
    maxLoss: highSlope < 0 ? 'Unlimited' : roundTo(Math.abs(finiteMin), 2),
    breakevens: [...new Set(breakevens.map((value) => roundTo(value, 2)))],
    currentGreeks: current.practical,
    gammaBias:
      Math.abs(gamma) < 1e-8 ? 'Flat gamma' : gamma > 0 ? 'Long gamma' : 'Short gamma',
    vegaBias:
      Math.abs(vega) < 1e-8 ? 'Flat vega' : vega > 0 ? 'Long vega' : 'Short vega',
    sensitiveSpot: roundTo(sensitiveSpot, 2),
  }
}

export function yAxisLabel(axisMode: AxisMode): string {
  return axisMode === 'spot-time' ? 'Days Elapsed' : 'IV'
}
