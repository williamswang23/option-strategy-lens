import { linspace, MIN_DTE_DAYS } from './math'
import { evaluateStrategy, selectMetricValue } from './strategy'
import type {
  AxisMode,
  DisplayMode,
  GreekMetric,
  MarketParams,
  OptionLeg,
  StrategyLeg,
  SurfaceGrid,
} from './types'

export interface GridConfig {
  axisMode: AxisMode
  metric: GreekMetric
  displayMode: DisplayMode
  spotPoints?: number
  yPoints?: number
}

export function buildSurfaceGrid(
  legs: StrategyLeg[],
  market: MarketParams,
  config: GridConfig,
): SurfaceGrid {
  const spotPoints = config.spotPoints ?? 101
  const yPoints = config.yPoints ?? 61
  const x = linspace(market.spot * 0.7, market.spot * 1.3, spotPoints)
  const optionDtes = legs
    .filter((leg): leg is OptionLeg => leg.kind === 'option')
    .map((leg) => leg.dteDays)
  const maxDte = Math.max(market.dteDays, ...optionDtes, MIN_DTE_DAYS)
  const y =
    config.axisMode === 'spot-time'
      ? linspace(0, maxDte, yPoints)
      : linspace(0.05, 0.8, yPoints)
  const initialPrice = evaluateStrategy(legs, market).practical.price

  const z = y.map((axisValue) =>
    x.map((spot) => {
      const pointMarket =
        config.axisMode === 'spot-time'
          ? { ...market, spot, dteDays: axisValue }
          : { ...market, spot, iv: axisValue }
      const evaluation = evaluateStrategy(
        legs,
        pointMarket,
        config.axisMode === 'spot-time'
          ? { elapsedDays: axisValue }
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
    x.map((spot) => {
      const pointMarket =
        config.axisMode === 'spot-time'
          ? { ...market, spot, dteDays: axisValue }
          : { ...market, spot, iv: axisValue }
      const evaluation = evaluateStrategy(
        legs,
        pointMarket,
        config.axisMode === 'spot-time'
          ? { elapsedDays: axisValue }
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
    y,
    z,
    rawZ,
    axisMode: config.axisMode,
    metric: config.metric,
    displayMode: config.displayMode,
  }
}
