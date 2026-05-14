export type OptionType = 'call' | 'put'
export type Side = 'long' | 'short'

export type GreekMetric =
  | 'price'
  | 'pnl'
  | 'delta'
  | 'gamma'
  | 'theta'
  | 'vega'
  | 'vanna'
  | 'charm'
  | 'volga'

export type AxisMode = 'spot-time' | 'spot-iv'
export type XAxisMode = 'spot' | 'log-moneyness'
export type DisplayMode = 'raw' | 'practical' | 'pnl-contribution'
export type ClippingMode = 'compressed' | 'percentile' | 'raw'
export type ResolutionMode = 'fast' | 'standard' | 'high'
export type VolModelKind = 'flat' | 'linear-skew' | 'skew-smile'
export type ScenarioKey = 'a' | 'b'
export type CompareView = 'a' | 'b' | 'diff'
export type TimeAxisKind = 'dte-remaining' | 'days-forward'

export interface VolModel {
  kind: VolModelKind
  skew: number
  curvature: number
}

export interface MarketParams {
  spot: number
  rate: number
  dividendYield: number
  iv: number
  dteDays: number
}

export interface OptionLeg {
  kind: 'option'
  type: OptionType
  side: Side
  quantity: number
  strike: number
  dteDays: number
  iv: number
  multiplier: number
}

export interface UnderlyingLeg {
  kind: 'underlying'
  side: Side
  quantity: number
  multiplier: number
}

export type StrategyLeg = OptionLeg | UnderlyingLeg

export interface StrategyDefaults {
  strike: number
  wingWidth: number
  quantity: number
  multiplier: number
}

export interface Strategy {
  id: string
  name: string
  description: string
  recommendedGreeks: GreekMetric[]
  defaults: StrategyDefaults
  buildLegs: (params: StrategyBuilderParams) => StrategyLeg[]
}

export interface StrategyBuilderParams extends MarketParams {
  strike: number
  wingWidth: number
  quantity: number
  multiplier: number
}

export interface GreekValues {
  price: number
  delta: number
  gamma: number
  theta: number
  vega: number
  vanna: number
  charm: number
  volga: number
}

export interface RawGreekValues extends GreekValues {
  thetaPerYear: number
  vegaPerVol: number
  vannaPerVol: number
  charmPerYear: number
  volgaPerVol: number
}

export interface EvaluatedStrategy {
  practical: GreekValues
  raw: RawGreekValues
}

export interface GridPoint {
  spot: number
  y: number
  value: number
  rawValue: number
}

export interface SurfaceGrid {
  x: number[]
  spots: number[]
  y: number[]
  z: number[][]
  rawZ: number[][]
  axisMode: AxisMode
  xAxisMode: XAxisMode
  metric: GreekMetric
  displayMode: DisplayMode
  referenceStrike: number
  currentX: number
  currentY: number
  timeAxisKind: TimeAxisKind
  yAxisLabel: string
}

export interface EvaluationOverrides {
  dteDays?: number
  iv?: number
  elapsedDays?: number
  volModel?: VolModel
}

export interface StrategySummary {
  netPremium: number
  maxProfit: number | 'Unlimited'
  maxLoss: number | 'Unlimited'
  breakevens: number[]
  currentGreeks: GreekValues
  gammaBias: 'Long gamma' | 'Short gamma' | 'Flat gamma'
  vegaBias: 'Long vega' | 'Short vega' | 'Flat vega'
  sensitiveSpot: number
}
