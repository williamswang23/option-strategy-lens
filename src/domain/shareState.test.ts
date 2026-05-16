import { describe, expect, it } from 'vitest'
import { decodeShareState, encodeShareState } from './shareState'
import type { AppShareState } from './shareState'

const state: AppShareState = {
  version: 1,
  strategyId: 'iron-condor',
  market: {
    spot: 100,
    rate: 0.05,
    dividendYield: 0,
    iv: 0.2,
    dteDays: 30,
  },
  builder: {
    strike: 100,
    wingWidth: 5,
    quantity: 1,
    multiplier: 100,
  },
  legs: [
    {
      kind: 'option',
      type: 'call',
      side: 'long',
      quantity: 1,
      strike: 100,
      dteDays: 30,
      iv: 0.2,
      multiplier: 100,
    },
  ],
  axisMode: 'spot-time',
  xAxisMode: 'spot',
  sliceValue: 7,
  metric: 'gamma',
  displayMode: 'practical',
  clippingMode: 'percentile',
  resolution: 'standard',
  volModel: { kind: 'skew-smile', skew: -0.25, curvature: 0.8 },
  compareState: {
    enabled: true,
    activeScenario: 'a',
    view: 'diff',
    scenarioB: {
      strategyId: 'long-straddle',
      builder: {
        strike: 100,
        wingWidth: 10,
        quantity: 1,
        multiplier: 100,
      },
      legs: [],
    },
  },
}

describe('share state', () => {
  it('roundtrips compact URL state', () => {
    const encoded = encodeShareState(state)

    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(decodeShareState(encoded)).toEqual(state)
  })

  it('returns null for invalid state', () => {
    expect(decodeShareState('not valid base64')).toBeNull()
  })
})
