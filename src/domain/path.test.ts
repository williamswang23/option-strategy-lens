import { describe, expect, it } from 'vitest'
import {
  buildPricePath,
  defaultPathConfigForMarket,
  parseBootstrapReturns,
} from './path'
import type { MarketParams } from './types'

const market: MarketParams = {
  spot: 100,
  rate: 0.05,
  dividendYield: 0,
  iv: 0.2,
  dteDays: 30,
}

describe('price path generation', () => {
  it('generates reproducible GBM paths from the same seed', () => {
    const config = {
      ...defaultPathConfigForMarket(market),
      enabled: true,
      horizonDays: 10,
      steps: 5,
      seed: 123,
      drift: 0.04,
      volatility: 0.25,
    }

    const first = buildPricePath(market, config)
    const second = buildPricePath(market, config)

    expect(first).toEqual(second)
    expect(first).toHaveLength(6)
    expect(first[0].spot).toBe(market.spot)
    expect(first[5].elapsedDays).toBe(10)
  })

  it('changes stochastic paths when the seed changes', () => {
    const config = {
      ...defaultPathConfigForMarket(market),
      enabled: true,
      horizonDays: 10,
      steps: 5,
      drift: 0.04,
      volatility: 0.25,
    }

    const first = buildPricePath(market, { ...config, seed: 1 })
    const second = buildPricePath(market, { ...config, seed: 2 })

    expect(first.map((point) => point.spot)).not.toEqual(
      second.map((point) => point.spot),
    )
  })

  it('linearly interpolates ATM IV when requested', () => {
    const config = {
      ...defaultPathConfigForMarket(market),
      enabled: true,
      horizonDays: 4,
      steps: 4,
      ivMode: 'linear' as const,
      terminalIv: 0.3,
    }

    const path = buildPricePath(market, config)

    expect(path[0].atmIv).toBeCloseTo(0.2, 10)
    expect(path[2].atmIv).toBeCloseTo(0.25, 10)
    expect(path[4].atmIv).toBeCloseTo(0.3, 10)
  })

  it('parses decimal and percent bootstrap returns', () => {
    expect(parseBootstrapReturns('-0.01, 0.5%, 0.02 bad')).toEqual([
      -0.01,
      0.005,
      0.02,
    ])
  })

  it('samples historical bootstrap returns as simple step returns', () => {
    const config = {
      ...defaultPathConfigForMarket(market),
      enabled: true,
      model: 'historical-bootstrap' as const,
      horizonDays: 3,
      steps: 3,
      seed: 7,
      bootstrapReturns: '1%',
    }

    const path = buildPricePath(market, config)

    expect(path[3].spot).toBeCloseTo(100 * 1.01 ** 3, 10)
  })
})
