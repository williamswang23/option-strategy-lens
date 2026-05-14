import { clamp, percentile } from '../domain/math'
import type { ClippingMode, DisplayMode, GreekMetric, SurfaceGrid, XAxisMode } from '../domain/types'

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

export function axisLabel(grid: SurfaceGrid): string {
  if (grid.axisMode === 'spot-iv') return 'ATM IV'
  return grid.yAxisLabel
}

export function xAxisLabel(xAxisMode: XAxisMode): string {
  return xAxisMode === 'log-moneyness' ? 'ln(K/F)' : 'Spot'
}

export function surfaceLabel(grid: SurfaceGrid): string {
  return `${xAxisLabel(grid.xAxisMode)} x ${axisLabel(grid)}`
}

export function formatAxisValue(grid: SurfaceGrid, value: number): string {
  if (grid.axisMode === 'spot-iv') return `${(value * 100).toFixed(0)}% ATM IV`
  return grid.timeAxisKind === 'days-forward'
    ? `${value.toFixed(1)} days forward`
    : `${value.toFixed(1)} DTE`
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
