import { describe, expect, it } from 'vitest'
import { resolveLegIv } from './volatility'
import type { MarketParams, OptionLeg } from './types'

const market: MarketParams = {
  spot: 100,
  rate: 0.05,
  dividendYield: 0,
  iv: 0.2,
  dteDays: 30,
}

const leg: OptionLeg = {
  kind: 'option',
  type: 'put',
  side: 'long',
  quantity: 1,
  strike: 90,
  dteDays: 30,
  iv: 0.35,
  multiplier: 100,
}

describe('teaching volatility models', () => {
  it('keeps per-leg IV in flat mode', () => {
    expect(
      resolveLegIv({
        leg,
        market,
        spot: market.spot,
        dteDays: leg.dteDays,
        atmIv: 0.2,
        volModel: { kind: 'flat', skew: -0.25, curvature: 0.8 },
      }),
    ).toBe(0.35)
  })

  it('applies skew and smile from ln(K/F) with clamp bounds', () => {
    const modeled = resolveLegIv({
      leg,
      market,
      spot: market.spot,
      dteDays: leg.dteDays,
      atmIv: 0.2,
      volModel: { kind: 'skew-smile', skew: -0.25, curvature: 0.8 },
    })

    expect(modeled).toBeGreaterThan(0.2)
    expect(modeled).toBeLessThan(3)

    const clamped = resolveLegIv({
      leg: { ...leg, strike: 1 },
      market,
      spot: market.spot,
      dteDays: leg.dteDays,
      atmIv: 0.2,
      volModel: { kind: 'linear-skew', skew: 20, curvature: 0 },
    })

    expect(clamped).toBe(0.01)
  })
})
