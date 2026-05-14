import { describe, expect, it } from 'vitest'
import { buildSurfaceGrid } from './grid'
import { MIN_DTE_DAYS, toYears } from './math'
import type { MarketParams, StrategyLeg } from './types'

const market: MarketParams = {
  spot: 100,
  rate: 0.05,
  dividendYield: 0,
  iv: 0.2,
  dteDays: 30,
}

const legs: StrategyLeg[] = [
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
]

describe('surface grid', () => {
  it('uses remaining DTE rather than elapsed days on the time axis', () => {
    const grid = buildSurfaceGrid(legs, market, {
      axisMode: 'spot-time',
      xAxisMode: 'spot',
      metric: 'gamma',
      displayMode: 'practical',
      yPoints: 3,
    })

    expect(grid.y[0]).toBe(MIN_DTE_DAYS)
    expect(grid.y[grid.y.length - 1]).toBe(market.dteDays)
    expect(grid.currentY).toBe(market.dteDays)
  })

  it('can express the spot scan as ln(K/F)', () => {
    const grid = buildSurfaceGrid(legs, market, {
      axisMode: 'spot-time',
      xAxisMode: 'log-moneyness',
      metric: 'delta',
      displayMode: 'practical',
      spotPoints: 3,
    })
    const expectedCurrentX = Math.log(
      100 / (market.spot * Math.exp((market.rate - market.dividendYield) * toYears(market.dteDays))),
    )

    expect(grid.xAxisMode).toBe('log-moneyness')
    expect(grid.referenceStrike).toBe(100)
    expect(grid.currentX).toBeCloseTo(expectedCurrentX, 10)
    expect(grid.x[0]).toBeLessThan(grid.x[grid.x.length - 1])
    expect(grid.spots[0]).toBeGreaterThan(grid.spots[grid.spots.length - 1])
  })
})
