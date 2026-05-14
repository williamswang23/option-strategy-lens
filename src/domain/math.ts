export const DAYS_PER_YEAR = 365
export const MIN_DTE_DAYS = 0.25
export const MIN_VOL = 0.0001

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + 0.3275911 * absX)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const erf =
    sign *
    (1 -
      (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp(-absX * absX)))

  return 0.5 * (1 + erf)
}

export function toYears(dteDays: number): number {
  return Math.max(dteDays, MIN_DTE_DAYS) / DAYS_PER_YEAR
}

export function linspace(start: number, end: number, points: number): number[] {
  if (points <= 1) return [start]
  const step = (end - start) / (points - 1)
  return Array.from({ length: points }, (_, index) => start + step * index)
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = clamp((sorted.length - 1) * p, 0, sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
