import type {
  OptionLeg,
  Side,
  Strategy,
  StrategyBuilderParams,
  StrategyLeg,
} from './types'

function optionLeg(
  params: StrategyBuilderParams,
  type: OptionLeg['type'],
  side: Side,
  strike: number,
  quantity = params.quantity,
): OptionLeg {
  return {
    kind: 'option',
    type,
    side,
    quantity,
    strike,
    dteDays: params.dteDays,
    iv: params.iv,
    multiplier: params.multiplier,
  }
}

function underlyingLeg(
  params: StrategyBuilderParams,
  side: Side,
): StrategyLeg {
  return {
    kind: 'underlying',
    side,
    quantity: params.quantity,
    multiplier: params.multiplier,
  }
}

function defaults(overrides?: Partial<Strategy['defaults']>): Strategy['defaults'] {
  return {
    strike: 100,
    wingWidth: 10,
    quantity: 1,
    multiplier: 100,
    ...overrides,
  }
}

export const strategies: Strategy[] = [
  {
    id: 'long-call',
    name: 'Long Call',
    description: 'Positive delta, positive gamma, negative theta, positive vega.',
    recommendedGreeks: ['delta', 'gamma', 'theta', 'vega'],
    defaults: defaults(),
    buildLegs: (params) => [optionLeg(params, 'call', 'long', params.strike)],
  },
  {
    id: 'short-call',
    name: 'Short Call',
    description: 'Negative delta, negative gamma, positive theta, negative vega.',
    recommendedGreeks: ['gamma', 'theta', 'pnl'],
    defaults: defaults(),
    buildLegs: (params) => [optionLeg(params, 'call', 'short', params.strike)],
  },
  {
    id: 'long-put',
    name: 'Long Put',
    description: 'Negative delta, positive gamma, negative theta, positive vega.',
    recommendedGreeks: ['delta', 'gamma', 'theta', 'vega'],
    defaults: defaults(),
    buildLegs: (params) => [optionLeg(params, 'put', 'long', params.strike)],
  },
  {
    id: 'short-put',
    name: 'Short Put',
    description: 'Positive delta, negative gamma, positive theta, negative vega.',
    recommendedGreeks: ['gamma', 'theta', 'pnl'],
    defaults: defaults(),
    buildLegs: (params) => [optionLeg(params, 'put', 'short', params.strike)],
  },
  {
    id: 'bull-call-spread',
    name: 'Bull Call Spread',
    description: 'Capped upside with localized positive gamma and range-shaped delta.',
    recommendedGreeks: ['delta', 'gamma', 'theta'],
    defaults: defaults({ wingWidth: 10 }),
    buildLegs: (params) => [
      optionLeg(params, 'call', 'long', params.strike),
      optionLeg(params, 'call', 'short', params.strike + params.wingWidth),
    ],
  },
  {
    id: 'bear-call-spread',
    name: 'Bear Call Spread',
    description: 'Credit call spread with short convexity near the upper strike zone.',
    recommendedGreeks: ['delta', 'gamma', 'theta'],
    defaults: defaults({ wingWidth: 10 }),
    buildLegs: (params) => [
      optionLeg(params, 'call', 'short', params.strike),
      optionLeg(params, 'call', 'long', params.strike + params.wingWidth),
    ],
  },
  {
    id: 'bull-put-spread',
    name: 'Bull Put Spread',
    description: 'Credit put spread with positive theta and downside short-gamma risk.',
    recommendedGreeks: ['delta', 'gamma', 'theta'],
    defaults: defaults({ wingWidth: 10 }),
    buildLegs: (params) => [
      optionLeg(params, 'put', 'long', params.strike - params.wingWidth),
      optionLeg(params, 'put', 'short', params.strike),
    ],
  },
  {
    id: 'bear-put-spread',
    name: 'Bear Put Spread',
    description: 'Defined-risk bearish exposure with downside convexity.',
    recommendedGreeks: ['delta', 'gamma', 'theta'],
    defaults: defaults({ wingWidth: 10 }),
    buildLegs: (params) => [
      optionLeg(params, 'put', 'long', params.strike),
      optionLeg(params, 'put', 'short', params.strike - params.wingWidth),
    ],
  },
  {
    id: 'long-straddle',
    name: 'Long Straddle',
    description: 'ATM positive gamma, positive vega, and negative theta.',
    recommendedGreeks: ['gamma', 'theta', 'vega', 'volga'],
    defaults: defaults(),
    buildLegs: (params) => [
      optionLeg(params, 'call', 'long', params.strike),
      optionLeg(params, 'put', 'long', params.strike),
    ],
  },
  {
    id: 'short-straddle',
    name: 'Short Straddle',
    description: 'ATM negative gamma, negative vega, and positive theta.',
    recommendedGreeks: ['gamma', 'theta', 'vega', 'pnl'],
    defaults: defaults(),
    buildLegs: (params) => [
      optionLeg(params, 'call', 'short', params.strike),
      optionLeg(params, 'put', 'short', params.strike),
    ],
  },
  {
    id: 'long-strangle',
    name: 'Long Strangle',
    description: 'Gamma and vega concentrate around both outer strikes.',
    recommendedGreeks: ['gamma', 'theta', 'vega', 'volga'],
    defaults: defaults({ wingWidth: 8 }),
    buildLegs: (params) => [
      optionLeg(params, 'put', 'long', params.strike - params.wingWidth),
      optionLeg(params, 'call', 'long', params.strike + params.wingWidth),
    ],
  },
  {
    id: 'short-strangle',
    name: 'Short Strangle',
    description: 'Theta collection inside the range with short-gamma tail exposure.',
    recommendedGreeks: ['gamma', 'theta', 'vega', 'pnl'],
    defaults: defaults({ wingWidth: 8 }),
    buildLegs: (params) => [
      optionLeg(params, 'put', 'short', params.strike - params.wingWidth),
      optionLeg(params, 'call', 'short', params.strike + params.wingWidth),
    ],
  },
  {
    id: 'call-butterfly',
    name: 'Call Butterfly',
    description: 'Pin-risk structure with gamma concentrated around the body strike.',
    recommendedGreeks: ['gamma', 'theta', 'pnl'],
    defaults: defaults({ wingWidth: 10 }),
    buildLegs: (params) => [
      optionLeg(params, 'call', 'long', params.strike - params.wingWidth),
      optionLeg(params, 'call', 'short', params.strike, params.quantity * 2),
      optionLeg(params, 'call', 'long', params.strike + params.wingWidth),
    ],
  },
  {
    id: 'put-butterfly',
    name: 'Put Butterfly',
    description: 'Pin-risk and gamma structure built with puts.',
    recommendedGreeks: ['gamma', 'theta', 'pnl'],
    defaults: defaults({ wingWidth: 10 }),
    buildLegs: (params) => [
      optionLeg(params, 'put', 'long', params.strike + params.wingWidth),
      optionLeg(params, 'put', 'short', params.strike, params.quantity * 2),
      optionLeg(params, 'put', 'long', params.strike - params.wingWidth),
    ],
  },
  {
    id: 'iron-condor',
    name: 'Iron Condor',
    description: 'Range theta collection with risk concentrated near the short strikes.',
    recommendedGreeks: ['gamma', 'theta', 'vega', 'pnl'],
    defaults: defaults({ wingWidth: 5 }),
    buildLegs: (params) => [
      optionLeg(params, 'put', 'long', params.strike - 2 * params.wingWidth),
      optionLeg(params, 'put', 'short', params.strike - params.wingWidth),
      optionLeg(params, 'call', 'short', params.strike + params.wingWidth),
      optionLeg(params, 'call', 'long', params.strike + 2 * params.wingWidth),
    ],
  },
  {
    id: 'risk-reversal',
    name: 'Risk Reversal',
    description: 'Directional delta and vanna exposure training.',
    recommendedGreeks: ['delta', 'vanna', 'vega'],
    defaults: defaults({ wingWidth: 8 }),
    buildLegs: (params) => [
      optionLeg(params, 'put', 'short', params.strike - params.wingWidth),
      optionLeg(params, 'call', 'long', params.strike + params.wingWidth),
    ],
  },
  {
    id: 'covered-call',
    name: 'Covered Call',
    description: 'Long underlying plus short call; shows capped delta and short gamma.',
    recommendedGreeks: ['delta', 'gamma', 'theta'],
    defaults: defaults({ wingWidth: 5, multiplier: 1 }),
    buildLegs: (params) => [
      underlyingLeg(params, 'long'),
      optionLeg(params, 'call', 'short', params.strike + params.wingWidth),
    ],
  },
  {
    id: 'protective-put',
    name: 'Protective Put',
    description: 'Long underlying plus long put; shows convexity protection.',
    recommendedGreeks: ['delta', 'gamma', 'theta', 'vega'],
    defaults: defaults({ wingWidth: 8, multiplier: 1 }),
    buildLegs: (params) => [
      underlyingLeg(params, 'long'),
      optionLeg(params, 'put', 'long', params.strike - params.wingWidth),
    ],
  },
  {
    id: 'collar',
    name: 'Collar',
    description: 'Underlying, long put, and short call combined Greeks.',
    recommendedGreeks: ['delta', 'gamma', 'theta', 'vega'],
    defaults: defaults({ wingWidth: 8, multiplier: 1 }),
    buildLegs: (params) => [
      underlyingLeg(params, 'long'),
      optionLeg(params, 'put', 'long', params.strike - params.wingWidth),
      optionLeg(params, 'call', 'short', params.strike + params.wingWidth),
    ],
  },
]

export const customStrategy: Strategy = {
  id: 'custom',
  name: 'Custom Strategy',
  description: 'Custom multi-leg structure.',
  recommendedGreeks: ['delta', 'gamma', 'theta', 'vega'],
  defaults: defaults(),
  buildLegs: () => [],
}

export const allStrategies = [...strategies, customStrategy]
