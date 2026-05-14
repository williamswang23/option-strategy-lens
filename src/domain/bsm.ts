import type { OptionType, RawGreekValues } from './types'
import {
  DAYS_PER_YEAR,
  MIN_DTE_DAYS,
  MIN_VOL,
  normalCdf,
  normalPdf,
  toYears,
} from './math'

export interface BsmInput {
  type: OptionType
  spot: number
  strike: number
  dteDays: number
  iv: number
  rate: number
  dividendYield: number
}

interface D1D2 {
  d1: number
  d2: number
  sqrtT: number
  t: number
  sigma: number
}

function d1d2(input: BsmInput): D1D2 {
  const spot = Math.max(input.spot, 0.000001)
  const strike = Math.max(input.strike, 0.000001)
  const sigma = Math.max(input.iv, MIN_VOL)
  const t = toYears(input.dteDays)
  const sqrtT = Math.sqrt(t)
  const drift =
    input.rate - input.dividendYield + 0.5 * sigma * sigma
  const d1 = (Math.log(spot / strike) + drift * t) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT

  return { d1, d2, sqrtT, t, sigma }
}

export function bsmPrice(input: BsmInput): number {
  const { d1, d2, t } = d1d2(input)
  const discountRate = Math.exp(-input.rate * t)
  const discountDividend = Math.exp(-input.dividendYield * t)

  if (input.type === 'call') {
    return (
      input.spot * discountDividend * normalCdf(d1) -
      input.strike * discountRate * normalCdf(d2)
    )
  }

  return (
    input.strike * discountRate * normalCdf(-d2) -
    input.spot * discountDividend * normalCdf(-d1)
  )
}

export function bsmDelta(input: BsmInput): number {
  const { d1, t } = d1d2(input)
  const discountDividend = Math.exp(-input.dividendYield * t)
  if (input.type === 'call') return discountDividend * normalCdf(d1)
  return discountDividend * (normalCdf(d1) - 1)
}

export function bsmGamma(input: BsmInput): number {
  const { d1, sqrtT, t, sigma } = d1d2(input)
  const discountDividend = Math.exp(-input.dividendYield * t)
  return (
    (discountDividend * normalPdf(d1)) /
    (Math.max(input.spot, 0.000001) * sigma * sqrtT)
  )
}

export function bsmVegaPerVol(input: BsmInput): number {
  const { d1, sqrtT, t } = d1d2(input)
  const discountDividend = Math.exp(-input.dividendYield * t)
  return input.spot * discountDividend * normalPdf(d1) * sqrtT
}

export function bsmThetaPerYear(input: BsmInput): number {
  const { d1, d2, sqrtT, t, sigma } = d1d2(input)
  const discountRate = Math.exp(-input.rate * t)
  const discountDividend = Math.exp(-input.dividendYield * t)
  const decay =
    (-input.spot * discountDividend * normalPdf(d1) * sigma) /
    (2 * sqrtT)

  if (input.type === 'call') {
    return (
      decay -
      input.rate * input.strike * discountRate * normalCdf(d2) +
      input.dividendYield * input.spot * discountDividend * normalCdf(d1)
    )
  }

  return (
    decay +
    input.rate * input.strike * discountRate * normalCdf(-d2) -
    input.dividendYield * input.spot * discountDividend * normalCdf(-d1)
  )
}

function withIv(input: BsmInput, iv: number): BsmInput {
  return { ...input, iv: Math.max(iv, MIN_VOL) }
}

function withDte(input: BsmInput, dteDays: number): BsmInput {
  return { ...input, dteDays: Math.max(dteDays, MIN_DTE_DAYS) }
}

export function bsmGreeks(input: BsmInput): RawGreekValues {
  const hVol = 0.0005
  const price = bsmPrice(input)
  const delta = bsmDelta(input)
  const gamma = bsmGamma(input)
  const thetaPerYear = bsmThetaPerYear(input)
  const theta = thetaPerYear / DAYS_PER_YEAR
  const vegaPerVol = bsmVegaPerVol(input)
  const vega = vegaPerVol * 0.01

  const upVol = withIv(input, input.iv + hVol)
  const downVol = withIv(input, input.iv - hVol)
  const vannaPerVol =
    (bsmDelta(upVol) - bsmDelta(downVol)) / (upVol.iv - downVol.iv)
  const volgaPerVol =
    (bsmVegaPerVol(upVol) - bsmVegaPerVol(downVol)) /
    (upVol.iv - downVol.iv)

  const nextDay = withDte(input, input.dteDays - 1)
  const charm = bsmDelta(nextDay) - delta
  const charmPerYear = charm * DAYS_PER_YEAR

  return {
    price,
    delta,
    gamma,
    theta,
    vega,
    vanna: vannaPerVol * 0.01,
    charm,
    volga: volgaPerVol * 0.0001,
    thetaPerYear,
    vegaPerVol,
    vannaPerVol,
    charmPerYear,
    volgaPerVol,
  }
}
