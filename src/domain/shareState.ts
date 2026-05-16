import type {
  AxisMode,
  ClippingMode,
  CompareView,
  DisplayMode,
  GreekMetric,
  MarketParams,
  ResolutionMode,
  ScenarioKey,
  StrategyDefaults,
  StrategyLeg,
  VolModel,
  XAxisMode,
} from './types'

export interface ScenarioShareState {
  strategyId: string
  builder: StrategyDefaults
  legs: StrategyLeg[]
}

export interface CompareShareState {
  enabled: boolean
  activeScenario: ScenarioKey
  view: CompareView
  scenarioB: ScenarioShareState
}

export interface AppShareState {
  version: 1
  strategyId: string
  market: MarketParams
  builder: StrategyDefaults
  legs: StrategyLeg[]
  axisMode: AxisMode
  xAxisMode: XAxisMode
  sliceValue?: number | null
  metric: GreekMetric
  displayMode: DisplayMode
  clippingMode: ClippingMode
  resolution: ResolutionMode
  volModel: VolModel
  compareState: CompareShareState
}

export function encodeShareState(state: AppShareState): string {
  const json = JSON.stringify(state)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

export function decodeShareState(encoded: string): AppShareState | null {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    if (!isRecord(parsed) || parsed.version !== 1) return null
    return parsed as unknown as AppShareState
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
