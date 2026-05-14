import { linspace, MIN_DTE_DAYS } from './math'
import { evaluateStrategy, selectMetricValue } from './strategy'
import {
  DEFAULT_VOL_MODEL,
  hasMultipleExpiries,
  logMoneyness,
  maxDteDays,
  referenceStrike,
} from './volatility'
import type {
  AxisMode,
  DisplayMode,
  GreekMetric,
  MarketParams,
  StrategyLeg,
  SurfaceGrid,
  TimeAxisKind,
  VolModel,
  XAxisMode,
} from './types'

export interface GridConfig {
  axisMode: AxisMode
  xAxisMode: XAxisMode
  metric: GreekMetric
  displayMode: DisplayMode
  volModel?: VolModel
  timeAxisKind?: TimeAxisKind
  timeMaxDays?: number
  spotPoints?: number
  yPoints?: number
}

function logMoneynessX(
  spot: number,
  market: MarketParams,
  strike: number,
): number {
  return logMoneyness(strike, spot, market, market.dteDays)
}

function timeAxisLabel(kind: TimeAxisKind): string {
  return kind === 'days-forward' ? 'Days Forward' : 'DTE Remaining'
}

export function buildSurfaceGrid(
  legs: StrategyLeg[],
  market: MarketParams,
  config: GridConfig,
): SurfaceGrid {
  const spotPoints = config.spotPoints ?? 101
  const yPoints = config.yPoints ?? 61
  const volModel = config.volModel ?? DEFAULT_VOL_MODEL
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
  const multiExpiry = hasMultipleExpiries(legs)
  const timeAxisKind: TimeAxisKind =
    config.timeAxisKind ??
    (config.axisMode === 'spot-time' && multiExpiry ? 'days-forward' : 'dte-remaining')
  const referenceDte = Math.max(config.timeMaxDays ?? maxDteDays(legs, market), MIN_DTE_DAYS)
  const y =
    config.axisMode === 'spot-time'
      ? timeAxisKind === 'days-forward'
        ? linspace(0, referenceDte, yPoints)
        : linspace(MIN_DTE_DAYS, Math.max(market.dteDays, MIN_DTE_DAYS), yPoints)
      : linspace(0.05, 0.8, yPoints)
  const initialPrice = evaluateStrategy(legs, market, { volModel }).practical.price

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
          ? {
              elapsedDays:
                timeAxisKind === 'days-forward'
                  ? axisValue
                  : Math.max(market.dteDays, MIN_DTE_DAYS) - axisValue,
              volModel,
            }
          : { iv: axisValue, volModel },
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
          ? {
              elapsedDays:
                timeAxisKind === 'days-forward'
                  ? axisValue
                  : Math.max(market.dteDays, MIN_DTE_DAYS) - axisValue,
              volModel,
            }
          : { iv: axisValue, volModel },
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
    currentY:
      config.axisMode === 'spot-time'
        ? timeAxisKind === 'days-forward'
          ? 0
          : Math.max(market.dteDays, MIN_DTE_DAYS)
        : market.iv,
    timeAxisKind,
    yAxisLabel: config.axisMode === 'spot-time' ? timeAxisLabel(timeAxisKind) : 'ATM IV',
  }
}

export function buildDifferenceGrid(
  left: SurfaceGrid,
  right: SurfaceGrid,
): SurfaceGrid {
  return {
    ...left,
    z: left.z.map((row, rowIndex) =>
      row.map((value, columnIndex) => value - right.z[rowIndex][columnIndex]),
    ),
    rawZ: left.rawZ.map((row, rowIndex) =>
      row.map((value, columnIndex) => value - right.rawZ[rowIndex][columnIndex]),
    ),
  }
}
