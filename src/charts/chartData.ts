import { clamp, percentile } from '../domain/math'
import type { ClippingMode, DisplayMode, GreekMetric, SurfaceGrid, XAxisMode } from '../domain/types'

export interface ZScaleResult {
  z: number[][]
  displayMin: number
  displayMax: number
  rawMin: number
  rawMax: number
  tickvals?: number[]
  ticktext?: string[]
}

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

export function scaleGridZ(
  grid: SurfaceGrid,
  clippingMode: ClippingMode,
): ZScaleResult {
  const values = grid.z.flat().filter(Number.isFinite)
  if (values.length === 0) {
    return { z: grid.z, displayMin: 0, displayMax: 0, rawMin: 0, rawMax: 0 }
  }

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  if (Math.abs(rawMax - rawMin) < 1e-12) {
    return {
      z: grid.z,
      displayMin: rawMin,
      displayMax: rawMax,
      rawMin,
      rawMax,
    }
  }

  if (clippingMode === 'compressed') {
    const absValues = values.map(Math.abs).filter((value) => value > 0)
    const compressionScale = Math.max(percentile(absValues, 0.75), 1e-12)
    const transform = (value: number) => Math.asinh(value / compressionScale)
    const tickSource = uniqueSorted([
      rawMin,
      percentile(values, 0.02),
      ...(rawMin < 0 && rawMax > 0 ? [0] : []),
      percentile(values, 0.98),
      rawMax,
    ])

    return {
      z: grid.z.map((row) => row.map(transform)),
      displayMin: transform(rawMin),
      displayMax: transform(rawMax),
      rawMin,
      rawMax,
      tickvals: tickSource.map(transform),
      ticktext: tickSource.map(formatScaleTick),
    }
  }

  const displayMin = clippingMode === 'percentile' ? percentile(values, 0.02) : rawMin
  const displayMax = clippingMode === 'percentile' ? percentile(values, 0.98) : rawMax
  if (Math.abs(displayMax - displayMin) < 1e-12) {
    return { z: grid.z, displayMin, displayMax, rawMin, rawMax }
  }

  return {
    z:
      clippingMode === 'percentile'
        ? grid.z.map((row) => row.map((value) => clamp(value, displayMin, displayMax)))
        : grid.z,
    displayMin,
    displayMax,
    rawMin,
    rawMax,
  }
}

export function clippedZ(grid: SurfaceGrid, clippingMode: ClippingMode): ZScaleResult {
  return scaleGridZ(grid, clippingMode)
}

export function nearestIndex(values: number[], target: number): number {
  return values.reduce((bestIndex, value, index) => {
    const bestDistance = Math.abs(values[bestIndex] - target)
    const distance = Math.abs(value - target)
    return distance < bestDistance ? index : bestIndex
  }, 0)
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((value) => Number(value.toPrecision(12))))].sort((a, b) => a - b)
}

function formatScaleTick(value: number): string {
  if (!Number.isFinite(value)) return 'n/a'
  const abs = Math.abs(value)
  if (abs >= 1000 || (abs > 0 && abs < 0.001)) return value.toExponential(1)
  if (abs >= 10) return value.toFixed(0)
  if (abs >= 1) return value.toFixed(1)
  if (abs >= 0.01) return value.toFixed(2)
  return value.toFixed(4)
}
