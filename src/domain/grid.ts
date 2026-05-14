import { linspace, MIN_DTE_DAYS, toYears } from './math'
import { evaluateStrategy, selectMetricValue } from './strategy'
import type {
  AxisMode,
  DisplayMode,
  GreekMetric,
  MarketParams,
  OptionLeg,
  StrategyLeg,
  SurfaceGrid,
  XAxisMode,
} from './types'

export interface GridConfig {
  axisMode: AxisMode
  xAxisMode: XAxisMode
  metric: GreekMetric
  displayMode: DisplayMode
  spotPoints?: number
  yPoints?: number
}

function referenceStrike(legs: StrategyLeg[], market: MarketParams): number {
  const optionLegs = legs.filter((leg): leg is OptionLeg => leg.kind === 'option')
  const totalQuantity = optionLegs.reduce((total, leg) => total + leg.quantity, 0)
  if (totalQuantity <= 0) return market.spot

  return (
    optionLegs.reduce((total, leg) => total + leg.strike * leg.quantity, 0) /
    totalQuantity
  )
}

function logMoneynessX(
  spot: number,
  market: MarketParams,
  strike: number,
): number {
  const forward = spot * Math.exp((market.rate - market.dividendYield) * toYears(market.dteDays))
  return Math.log(strike / Math.max(forward, 0.000001))
}

export function buildSurfaceGrid(
  legs: StrategyLeg[],
  market: MarketParams,
  config: GridConfig,
): SurfaceGrid {
  const spotPoints = config.spotPoints ?? 101
  const yPoints = config.yPoints ?? 61
  const strikeReference = referenceStrike(legs, market)
  const spotRange = linspace(market.spot * 0.7, market.spot * 1.3, spotPoints)
  const points =
    config.xAxisMode === 'log-moneyness'
      ? spotRange
          .map((spot) => ({
            spot,
            x: logMoneynessX(spot, market, strikeReference),
          }))
          .sort((left, right) => left.x - right.x)
      : spotRange.map((spot) => ({ spot, x: spot }))
  const spots = points.map((point) => point.spot)
  const x = points.map((point) => point.x)
  const referenceDte = Math.max(market.dteDays, MIN_DTE_DAYS)
  const y =
    config.axisMode === 'spot-time'
      ? linspace(MIN_DTE_DAYS, referenceDte, yPoints)
      : linspace(0.05, 0.8, yPoints)
  const initialPrice = evaluateStrategy(legs, market).practical.price

  const z = y.map((axisValue) =>
    spots.map((spot) => {
      const pointMarket =
        config.axisMode === 'spot-time'
          ? { ...market, spot, dteDays: axisValue }
          : { ...market, spot, iv: axisValue }
      const evaluation = evaluateStrategy(
        legs,
        pointMarket,
        config.axisMode === 'spot-time'
          ? { elapsedDays: referenceDte - axisValue }
          : { iv: axisValue },
      )
      return selectMetricValue(
        evaluation,
        config.metric,
        config.displayMode,
        spot,
        initialPrice,
      ).value
    }),
  )

  const rawZ = y.map((axisValue) =>
    spots.map((spot) => {
      const pointMarket =
        config.axisMode === 'spot-time'
          ? { ...market, spot, dteDays: axisValue }
          : { ...market, spot, iv: axisValue }
      const evaluation = evaluateStrategy(
        legs,
        pointMarket,
        config.axisMode === 'spot-time'
          ? { elapsedDays: referenceDte - axisValue }
          : { iv: axisValue },
      )
      return selectMetricValue(
        evaluation,
        config.metric,
        'practical',
        spot,
        initialPrice,
      ).rawValue
    }),
  )

  return {
    x,
    spots,
    y,
    z,
    rawZ,
    axisMode: config.axisMode,
    xAxisMode: config.xAxisMode,
    metric: config.metric,
    displayMode: config.displayMode,
    referenceStrike: strikeReference,
    currentX:
      config.xAxisMode === 'log-moneyness'
        ? logMoneynessX(market.spot, market, strikeReference)
        : market.spot,
    currentY: config.axisMode === 'spot-time' ? referenceDte : market.iv,
  }
}
