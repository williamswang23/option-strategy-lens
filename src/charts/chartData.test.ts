import { describe, expect, it } from 'vitest'
import { scaleGridZ } from './chartData'
import type { SurfaceGrid } from '../domain/types'

const baseGrid: SurfaceGrid = {
  x: [90, 95, 100, 105, 110],
  spots: [90, 95, 100, 105, 110],
  y: [30],
  z: [[-100, -1, 0, 1, 100]],
  rawZ: [[-100, -1, 0, 1, 100]],
  axisMode: 'spot-time',
  xAxisMode: 'spot',
  metric: 'gamma',
  displayMode: 'practical',
  referenceStrike: 100,
  currentX: 100,
  currentY: 30,
  timeAxisKind: 'dte-remaining',
  yAxisLabel: 'DTE Remaining',
}

describe('scaleGridZ', () => {
  it('compresses extreme values without flattening them into clipping plateaus', () => {
    const scaled = scaleGridZ(baseGrid, 'compressed')

    expect(scaled.rawMin).toBe(-100)
    expect(scaled.rawMax).toBe(100)
    expect(scaled.z[0][0]).toBeLessThan(scaled.z[0][1])
    expect(scaled.z[0][3]).toBeLessThan(scaled.z[0][4])
    expect(Math.abs(scaled.z[0][4])).toBeLessThan(100)
    expect(scaled.tickvals?.length).toBeGreaterThan(0)
    expect(scaled.ticktext).toContain('0.0000')
  })

  it('keeps raw scale unchanged when requested', () => {
    const scaled = scaleGridZ(baseGrid, 'raw')

    expect(scaled.z).toEqual(baseGrid.z)
    expect(scaled.displayMin).toBe(-100)
    expect(scaled.displayMax).toBe(100)
  })
})
