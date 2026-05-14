import { describe, expect, it } from 'vitest'
import { bsmGreeks } from './bsm'
import { strategies } from './strategies'
import { evaluateStrategy } from './strategy'
import type { MarketParams, OptionLeg, StrategyLeg } from './types'

const market: MarketParams = {
  spot: 100,
  rate: 0.05,
  dividendYield: 0,
  iv: 0.2,
  dteDays: 30,
}

function longCall(): OptionLeg {
  return {
    kind: 'option',
    type: 'call',
    side: 'long',
    quantity: 1,
    strike: 100,
    dteDays: 30,
    iv: 0.2,
    multiplier: 100,
  }
}

describe('strategy evaluation', () => {
  it('flips signs between long and short legs', () => {
    const long = evaluateStrategy([longCall()], market).practical
    const shortLeg: StrategyLeg = { ...longCall(), side: 'short' }
    const short = evaluateStrategy([shortLeg], market).practical

    expect(short.price).toBeCloseTo(-long.price, 6)
    expect(short.delta).toBeCloseTo(-long.delta, 6)
    expect(short.gamma).toBeCloseTo(-long.gamma, 6)
    expect(short.vega).toBeCloseTo(-long.vega, 6)
  })

  it('adds option legs linearly', () => {
    const legs: StrategyLeg[] = [
      longCall(),
      { ...longCall(), type: 'put', strike: 95 },
    ]
    const strategy = evaluateStrategy(legs, market).practical
    const call = bsmGreeks({ ...market, type: 'call', strike: 100 })
    const put = bsmGreeks({ ...market, type: 'put', strike: 95 })

    expect(strategy.price).toBeCloseTo((call.price + put.price) * 100, 6)
    expect(strategy.delta).toBeCloseTo((call.delta + put.delta) * 100, 6)
    expect(strategy.gamma).toBeCloseTo((call.gamma + put.gamma) * 100, 6)
  })

  it('builds vertical, straddle, and iron condor templates with expected leg counts', () => {
    const builder = {
      ...market,
      strike: 100,
      wingWidth: 5,
      quantity: 1,
      multiplier: 100,
    }

    expect(
      strategies.find((strategy) => strategy.id === 'bull-call-spread')?.buildLegs(builder),
    ).toHaveLength(2)
    expect(
      strategies.find((strategy) => strategy.id === 'long-straddle')?.buildLegs(builder),
    ).toHaveLength(2)
    expect(
      strategies.find((strategy) => strategy.id === 'iron-condor')?.buildLegs(builder),
    ).toHaveLength(4)
    expect(
      strategies.find((strategy) => strategy.id === 'calendar-spread')?.buildLegs(builder),
    ).toHaveLength(2)
  })

  it('underlying legs only contribute price and delta', () => {
    const underlying: StrategyLeg = {
      kind: 'underlying',
      side: 'long',
      quantity: 2,
      multiplier: 1,
    }
    const evaluated = evaluateStrategy([underlying], market).practical

    expect(evaluated.price).toBe(200)
    expect(evaluated.delta).toBe(2)
    expect(evaluated.gamma).toBe(0)
    expect(evaluated.theta).toBe(0)
    expect(evaluated.vega).toBe(0)
  })

  it('treats expired option legs as payoff only with zero Greeks', () => {
    const expired = evaluateStrategy([longCall()], { ...market, spot: 110 }, {
      elapsedDays: 31,
    }).practical

    expect(expired.price).toBe(1000)
    expect(expired.delta).toBe(0)
    expect(expired.gamma).toBe(0)
    expect(expired.theta).toBe(0)
    expect(expired.vega).toBe(0)
  })
})
