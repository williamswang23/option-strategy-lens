import { clamp, percentile } from '../domain/math'
import { yAxisLabel } from '../domain/strategy'
import type { AxisMode, ClippingMode, DisplayMode, GreekMetric, SurfaceGrid } from '../domain/types'

export const metricLabels: Record<GreekMetric, string> = {
  price: 'Strategy Value',
  pnl: 'P&L',
  delta: 'Delta',
  gamma: 'Gamma',
  theta: 'Theta / day',
  vega: 'Vega / 1 vol',
  vanna: 'Vanna / 1 vol',
  charm: 'Charm / day',
  volga: 'Volga / 1 vol',
}

export const displayModeLabels: Record<DisplayMode, string> = {
  raw: 'Raw',
  practical: 'Practical',
  'pnl-contribution': 'P&L Contribution',
}

export function axisLabel(axisMode: AxisMode): string {
  return yAxisLabel(axisMode)
}

export function formatAxisValue(axisMode: AxisMode, value: number): string {
  if (axisMode === 'spot-iv') return `${(value * 100).toFixed(0)}%`
  return `${value.toFixed(1)}d elapsed`
}

export function clippedZ(
  grid: SurfaceGrid,
  clippingMode: ClippingMode,
): { z: number[][]; min: number; max: number } {
  const values = grid.z.flat().filter(Number.isFinite)
  if (values.length === 0) return { z: grid.z, min: 0, max: 0 }
  const min = clippingMode === 'percentile' ? percentile(values, 0.02) : Math.min(...values)
  const max = clippingMode === 'percentile' ? percentile(values, 0.98) : Math.max(...values)
  if (Math.abs(max - min) < 1e-12) return { z: grid.z, min, max }

  return {
    z: grid.z.map((row) => row.map((value) => clamp(value, min, max))),
    min,
    max,
  }
}

export function nearestIndex(values: number[], target: number): number {
  return values.reduce((bestIndex, value, index) => {
    const bestDistance = Math.abs(values[bestIndex] - target)
    const distance = Math.abs(value - target)
    return distance < bestDistance ? index : bestIndex
  }, 0)
}
