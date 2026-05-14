import { describe, expect, it } from 'vitest'
import { bsmGreeks, bsmPrice } from './bsm'
import { toYears } from './math'

const baseInput = {
  spot: 100,
  strike: 100,
  dteDays: 30,
  iv: 0.2,
  rate: 0.05,
  dividendYield: 0,
}

describe('bsm', () => {
  it('satisfies put-call parity with continuous rates', () => {
    const call = bsmPrice({ ...baseInput, type: 'call' })
    const put = bsmPrice({ ...baseInput, type: 'put' })
    const t = toYears(baseInput.dteDays)
    const parity =
      baseInput.spot * Math.exp(-baseInput.dividendYield * t) -
      baseInput.strike * Math.exp(-baseInput.rate * t)

    expect(call - put).toBeCloseTo(parity, 4)
  })

  it('returns expected long call and put greek signs', () => {
    const call = bsmGreeks({ ...baseInput, rate: 0, type: 'call' })
    const put = bsmGreeks({ ...baseInput, rate: 0, type: 'put' })

    expect(call.delta).toBeGreaterThan(0)
    expect(put.delta).toBeLessThan(0)
    expect(call.gamma).toBeGreaterThan(0)
    expect(put.gamma).toBeGreaterThan(0)
    expect(call.vega).toBeGreaterThan(0)
    expect(put.vega).toBeGreaterThan(0)
    expect(call.theta).toBeLessThan(0)
    expect(put.theta).toBeLessThan(0)
  })

  it('uses practical vega as value change per one vol point', () => {
    const greeks = bsmGreeks({ ...baseInput, type: 'call' })

    expect(greeks.vega).toBeCloseTo(greeks.vegaPerVol * 0.01, 8)
  })

  it('handles very low DTE without non-finite values', () => {
    const greeks = bsmGreeks({
      ...baseInput,
      type: 'call',
      dteDays: 0.001,
      strike: 100,
    })

    expect(Number.isFinite(greeks.price)).toBe(true)
    expect(Number.isFinite(greeks.gamma)).toBe(true)
    expect(Number.isFinite(greeks.theta)).toBe(true)
  })
})
