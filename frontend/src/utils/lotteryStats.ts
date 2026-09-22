/**
 * Core statistics for the XSMB dashboard. All functions are pure and work on the compact Dataset
 * from services/dataLoader.ts, so components can wrap them in useMemo.
 *
 * Conventions:
 * - A "range" is a half-open interval of draw indexes [from, to) into the ascending dataset.
 * - Scope 'all' uses the 27 prizes (Lô tô); scope 'special' uses only the special prize (Đề).
 * - Counts called "lượt" count every hit, so a number drawn twice in one day (nháy) counts 2.
 *   Counts called "ngày" / "kỳ" count a draw at most once per number.
 * - Gan = number of consecutive draws without the number. Nhịp = distance in draws between two
 *   consecutive appearances (nhịp = gan + 1).
 */

import { SLOTS_PER_DRAW, type Dataset } from '../services/dataLoader.ts'

export const NUMBER_COUNT = 100

export type PrizeScope = 'all' | 'special'

export type TimeFilter =
  | { kind: 'lastDraws'; count: number }
  | { kind: 'lastYears'; years: number }
  | { kind: 'all' }
  | { kind: 'custom'; start: string; end: string }

export interface DrawRange {
  /** First draw index, inclusive. */
  from: number
  /** Last draw index, exclusive. */
  to: number
}

export interface RankedNumber {
  number: number
  value: number
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Formats 0–99 as a two-digit string ("07"). */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function head(n: number): number {
  return Math.floor(n / 10)
}

export function tail(n: number): number {
  return n % 10
}

/** First index i with arr[i] >= x. */
export function lowerBound<T extends number | string>(arr: ArrayLike<T>, x: T, lo = 0, hi = arr.length): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid] < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** First index i with arr[i] > x. */
export function upperBound<T extends number | string>(arr: ArrayLike<T>, x: T, lo = 0, hi = arr.length): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid] <= x) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Slot interval [start, end) of a draw that belongs to the scope. */
export function scopeSlots(scope: PrizeScope): [number, number] {
  return scope === 'special' ? [0, 1] : [0, SLOTS_PER_DRAW]
}

export function slotsPerDraw(scope: PrizeScope): number {
  const [start, end] = scopeSlots(scope)
  return end - start
}

/** Shifts a "YYYY-MM-DD" date by whole years, clamping 29 Feb to 28 Feb in non-leap years. */
export function shiftYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const year = y + years
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return `${year}-${String(m).padStart(2, '0')}-${String(Math.min(d, daysInMonth)).padStart(2, '0')}`
}

/** True when the range contains no draw, so components can render an empty state. */
export function rangeIsEmpty(range: DrawRange): boolean {
  return range.to <= range.from
}

// ---------------------------------------------------------------------------
// Time filter
// ---------------------------------------------------------------------------

/**
 * Converts a UI time filter into a draw range.
 * 'lastYears' matches the Python analysis: dates in (lastDate - years, lastDate].
 */
export function resolveRange(ds: Dataset, filter: TimeFilter): DrawRange {
  const { dates, size } = ds
  if (size === 0) return { from: 0, to: 0 }

  switch (filter.kind) {
    case 'all':
      return { from: 0, to: size }
    case 'lastDraws':
      return { from: Math.max(0, size - Math.max(0, Math.floor(filter.count))), to: size }
    case 'lastYears': {
      const startExclusive = shiftYears(dates[size - 1], -filter.years)
      return { from: upperBound(dates, startExclusive), to: size }
    }
    case 'custom': {
      const [start, end] = filter.start <= filter.end ? [filter.start, filter.end] : [filter.end, filter.start]
      return { from: lowerBound(dates, start), to: upperBound(dates, end) }
    }
  }
}

// ---------------------------------------------------------------------------
// Frequency
// ---------------------------------------------------------------------------

export interface FrequencyResult {
  /** counts[n] = number of hits (lượt về) of n in the range. */
  counts: Uint32Array
  /** Total numbers drawn in the range (draws × slots). */
  total: number
  draws: number
  /** Expected hits per number if every number were equally likely. */
  expected: number
}

export function countFrequency(ds: Dataset, range: DrawRange, scope: PrizeScope): FrequencyResult {
  const counts = new Uint32Array(NUMBER_COUNT)
  const [start, end] = scopeSlots(scope)
  for (let draw = range.from; draw < range.to; draw++) {
    const base = draw * SLOTS_PER_DRAW
    for (let slot = start; slot < end; slot++) counts[ds.numbers[base + slot]]++
  }
  const draws = Math.max(0, range.to - range.from)
  const total = draws * (end - start)
  return { counts, total, draws, expected: total / NUMBER_COUNT }
}

/** Reshapes 100 values into a 10×10 matrix indexed [head][tail]. */
export function toMatrix10(values: ArrayLike<number>): number[][] {
  return Array.from({ length: 10 }, (_, h) => Array.from({ length: 10 }, (_, t) => values[h * 10 + t]))
}

/**
 * Returns the `limit` numbers with the highest (desc) or lowest (asc) value.
 * Ties are broken by the smaller number first so the output is stable.
 */
export function rankNumbers(values: ArrayLike<number>, limit: number, order: 'desc' | 'asc' = 'desc'): RankedNumber[] {
  const sign = order === 'desc' ? -1 : 1
  return Array.from({ length: values.length }, (_, number) => ({ number, value: values[number] }))
    .sort((a, b) => sign * (a.value - b.value) || a.number - b.number)
    .slice(0, limit)
}

export interface MatrixStats {
  min: number
  max: number
  mean: number
  std: number
}

/** Min / max / mean / sample standard deviation, as reported by the Python analysis. */
export function describe(values: ArrayLike<number>): MatrixStats {
  const n = values.length
  if (n === 0) return { min: 0, max: 0, mean: 0, std: 0 }
  let min = Infinity
  let max = -Infinity
  let sum = 0
  for (let i = 0; i < n; i++) {
    const v = values[i]
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const mean = sum / n
  let sq = 0
  for (let i = 0; i < n; i++) sq += (values[i] - mean) ** 2
  return { min, max, mean, std: n > 1 ? Math.sqrt(sq / (n - 1)) : 0 }
}

// ---------------------------------------------------------------------------
// Occurrence index (basis for gan, nhịp and nháy)
// ---------------------------------------------------------------------------

export interface OccurrenceIndex {
  scope: PrizeScope
  /** draws[n] = ascending draw indexes on which n appeared at least once. */
  draws: Int32Array[]
  /** hits[n][i] = how many times n appeared on draw draws[n][i] (≥ 2 means nháy). */
  hits: Uint8Array[]
}

/**
 * Builds, for every number, the sorted list of draws it appeared on. Build it once per scope over the
 * whole dataset; range queries then use binary search on these lists.
 */
export function buildOccurrenceIndex(ds: Dataset, scope: PrizeScope): OccurrenceIndex {
  const [start, end] = scopeSlots(scope)
  const perDraw = new Uint8Array(NUMBER_COUNT)
  const touched: number[] = []

  // Pass 1: how many draws each number appears on, to size the typed arrays exactly.
  const lengths = new Int32Array(NUMBER_COUNT)
  for (let draw = 0; draw < ds.size; draw++) {
    const base = draw * SLOTS_PER_DRAW
    for (let slot = start; slot < end; slot++) {
      const n = ds.numbers[base + slot]
      if (perDraw[n]++ === 0) touched.push(n)
    }
    for (const n of touched) {
      lengths[n]++
      perDraw[n] = 0
    }
    touched.length = 0
  }

  const draws = Array.from(lengths, (len) => new Int32Array(len))
  const hits = Array.from(lengths, (len) => new Uint8Array(len))
  const cursor = new Int32Array(NUMBER_COUNT)

  // Pass 2: fill.
  for (let draw = 0; draw < ds.size; draw++) {
    const base = draw * SLOTS_PER_DRAW
    for (let slot = start; slot < end; slot++) {
      const n = ds.numbers[base + slot]
      if (perDraw[n]++ === 0) touched.push(n)
    }
    for (const n of touched) {
      draws[n][cursor[n]] = draw
      hits[n][cursor[n]] = perDraw[n]
      cursor[n]++
      perDraw[n] = 0
    }
    touched.length = 0
  }

  return { scope, draws, hits }
}

/** Index interval [lo, hi) into index.draws[n] covering the draw range. */
function occurrenceSlice(index: OccurrenceIndex, n: number, range: DrawRange): [number, number] {
  const list = index.draws[n]
  return [lowerBound(list, range.from), lowerBound(list, range.to)]
}

/** Number of draws in the range on which each number appeared at least once (số ngày về). */
export function countDaysPresent(index: OccurrenceIndex, range: DrawRange): Uint32Array {
  const result = new Uint32Array(NUMBER_COUNT)
  for (let n = 0; n < NUMBER_COUNT; n++) {
    const [lo, hi] = occurrenceSlice(index, n, range)
    result[n] = hi - lo
  }
  return result
}

/** Number of draws in the range on which each number appeared 2+ times (nháy). */
export function countMultiHits(index: OccurrenceIndex, range: DrawRange): Uint32Array {
  const result = new Uint32Array(NUMBER_COUNT)
  for (let n = 0; n < NUMBER_COUNT; n++) {
    const [lo, hi] = occurrenceSlice(index, n, range)
    const hits = index.hits[n]
    for (let i = lo; i < hi; i++) if (hits[i] >= 2) result[n]++
  }
  return result
}

// ---------------------------------------------------------------------------
// Lô gan (droughts)
// ---------------------------------------------------------------------------

export interface GanStat {
  number: number
  /** Consecutive draws without the number, counted back from the last draw of the range. */
  current: number
  /** Longest drought in the range, including the ongoing one. */
  max: number
  /** Date the record drought ended (the number came back), or null if the record is ongoing / none. */
  maxEndDate: string | null
  /** Date the number last appeared in the range, or null if it never appeared. */
  lastSeen: string | null
  /** current / max (0 when max is 0). */
  ratio: number
  /** current has reached `alertRatio` × max. */
  alert: boolean
  /** Draws in the range on which the number appeared. */
  appearances: number
}

/**
 * Computes current and record droughts for every number. For the "kỷ lục gan lịch sử" view pass
 * the full range { from: 0, to: ds.size }.
 *
 * The drought before a number's first appearance in the range is not counted towards the record,
 * because it may have started before the range (it is censored).
 */
export function computeGanStats(
  ds: Dataset,
  index: OccurrenceIndex,
  range: DrawRange,
  alertRatio = 0.8,
): GanStat[] {
  const stats: GanStat[] = []
  const lastDraw = range.to - 1

  for (let n = 0; n < NUMBER_COUNT; n++) {
    const list = index.draws[n]
    const [lo, hi] = occurrenceSlice(index, n, range)
    const appearances = hi - lo

    let max = 0
    let maxEndDate: string | null = null
    for (let i = lo + 1; i < hi; i++) {
      const gap = list[i] - list[i - 1] - 1
      if (gap > max) {
        max = gap
        maxEndDate = ds.dates[list[i]]
      }
    }

    const current = appearances > 0 ? lastDraw - list[hi - 1] : Math.max(0, range.to - range.from)
    if (current > max) {
      max = current
      maxEndDate = null
    }

    const ratio = max > 0 ? current / max : 0
    stats.push({
      number: n,
      current,
      max,
      maxEndDate,
      lastSeen: appearances > 0 ? ds.dates[list[hi - 1]] : null,
      ratio,
      alert: current > 0 && max > 0 && ratio >= alertRatio,
      appearances,
    })
  }

  return stats
}

// ---------------------------------------------------------------------------
// Nhịp rơi (appearance cycle of one number)
// ---------------------------------------------------------------------------

export interface CyclePoint {
  draw: number
  date: string
  /** Times the number was drawn that day. */
  hits: number
  /** Draws since the previous appearance in the range (null for the first). */
  gap: number | null
}

export interface CycleStat {
  number: number
  points: CyclePoint[]
  gaps: number[]
  meanGap: number | null
  medianGap: number | null
  minGap: number | null
  maxGap: number | null
  /** Draws since the last appearance, up to the end of the range (the current gan). */
  currentGan: number
  /** Theoretical mean nhịp if all numbers are equally likely: 1 / P(appears in one draw). */
  expectedGap: number
}

/** P(a given number appears at least once in a draw) under a uniform, independent model. */
export function probabilityPerDraw(scope: PrizeScope): number {
  return 1 - (1 - 1 / NUMBER_COUNT) ** slotsPerDraw(scope)
}

export function computeCycle(ds: Dataset, index: OccurrenceIndex, n: number, range: DrawRange): CycleStat {
  const list = index.draws[n]
  const hitList = index.hits[n]
  const [lo, hi] = occurrenceSlice(index, n, range)

  const points: CyclePoint[] = []
  const gaps: number[] = []
  for (let i = lo; i < hi; i++) {
    const gap = i > lo ? list[i] - list[i - 1] : null
    if (gap !== null) gaps.push(gap)
    points.push({ draw: list[i], date: ds.dates[list[i]], hits: hitList[i], gap })
  }

  let meanGap: number | null = null
  let medianGap: number | null = null
  let minGap: number | null = null
  let maxGap: number | null = null
  if (gaps.length > 0) {
    const sorted = [...gaps].sort((a, b) => a - b)
    const mid = sorted.length >> 1
    meanGap = sorted.reduce((s, g) => s + g, 0) / sorted.length
    medianGap = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    minGap = sorted[0]
    maxGap = sorted[sorted.length - 1]
  }

  return {
    number: n,
    points,
    gaps,
    meanGap,
    medianGap,
    minGap,
    maxGap,
    currentGan: hi > lo ? range.to - 1 - list[hi - 1] : Math.max(0, range.to - range.from),
    expectedGap: 1 / probabilityPerDraw(index.scope),
  }
}

export interface GapBin {
  /** Inclusive lower bound of the nhịp interval. */
  from: number
  /** Inclusive upper bound, or null for the open-ended last bin. */
  to: number | null
  observed: number
  /** Expected count under a geometric distribution with the per-draw appearance probability. */
  expected: number
}

/**
 * Histogram of nhịp values against the geometric distribution a memoryless random draw produces:
 * P(nhịp = k) = p (1 − p)^(k − 1).
 */
export function gapDistribution(gaps: readonly number[], p: number, binWidth: number, binCount: number): GapBin[] {
  const q = 1 - p
  const bins: GapBin[] = Array.from({ length: binCount }, (_, i) => {
    const from = 1 + i * binWidth
    const to = i === binCount - 1 ? null : from + binWidth - 1
    // P(from ≤ G ≤ to) = q^(from − 1) − q^to; the open-ended last bin is q^(from − 1).
    const probability = q ** (from - 1) - (to === null ? 0 : q ** to)
    return { from, to, observed: 0, expected: gaps.length * probability }
  })
  for (const g of gaps) {
    const i = Math.min(binCount - 1, Math.floor((g - 1) / binWidth))
    if (i >= 0) bins[i].observed++
  }
  return bins
}

// ---------------------------------------------------------------------------
// Đầu / Đuôi / Chạm / Tổng
// ---------------------------------------------------------------------------

export interface DigitDistribution {
  /** heads[d] = hits whose tens digit is d. */
  heads: Uint32Array
  /** tails[d] = hits whose units digit is d. */
  tails: Uint32Array
  /** touches[d] = hits containing digit d (chạm; 55 counts once for chạm 5). */
  touches: Uint32Array
  total: number
}

export function digitDistribution(freq: FrequencyResult): DigitDistribution {
  const heads = new Uint32Array(10)
  const tails = new Uint32Array(10)
  const touches = new Uint32Array(10)
  for (let n = 0; n < NUMBER_COUNT; n++) {
    const c = freq.counts[n]
    if (c === 0) continue
    const h = head(n)
    const t = tail(n)
    heads[h] += c
    tails[t] += c
    touches[h] += c
    if (t !== h) touches[t] += c
  }
  return { heads, tails, touches, total: freq.total }
}

export interface LotoRow {
  head: number
  /** Tails (ascending, repeated for nháy) of numbers with this head in the draw. */
  tails: number[]
}

/** Đầu–đuôi table of one draw, as shown on the README (e.g. head 4 → [4, 4, 6, 8]). */
export function lotoTable(ds: Dataset, draw: number, scope: PrizeScope = 'all'): LotoRow[] {
  const rows: LotoRow[] = Array.from({ length: 10 }, (_, h) => ({ head: h, tails: [] }))
  const [start, end] = scopeSlots(scope)
  const base = draw * SLOTS_PER_DRAW
  for (let slot = start; slot < end; slot++) {
    const n = ds.numbers[base + slot]
    rows[head(n)].tails.push(tail(n))
  }
  for (const row of rows) row.tails.sort((a, b) => a - b)
  return rows
}

/** Heads / tails that did not appear at all in one draw (đầu câm / đuôi câm). */
export function mutedDigits(ds: Dataset, draw: number, scope: PrizeScope = 'all'): { heads: number[]; tails: number[] } {
  const seenHeads = new Array<boolean>(10).fill(false)
  const seenTails = new Array<boolean>(10).fill(false)
  const [start, end] = scopeSlots(scope)
  const base = draw * SLOTS_PER_DRAW
  for (let slot = start; slot < end; slot++) {
    const n = ds.numbers[base + slot]
    seenHeads[head(n)] = true
    seenTails[tail(n)] = true
  }
  const missing = (seen: boolean[]) => seen.flatMap((s, d) => (s ? [] : [d]))
  return { heads: missing(seenHeads), tails: missing(seenTails) }
}

export interface DigitAbsence {
  digit: number
  /** Draws in the range where no number had this digit (in this position). */
  absentDraws: number
  /** Consecutive draws up to the end of the range without the digit. */
  currentStreak: number
  /** Longest run of consecutive draws without the digit in the range. */
  maxStreak: number
}

/** Đầu câm / đuôi câm over a range: how often and for how long each head and tail digit was missing. */
export function digitAbsence(ds: Dataset, range: DrawRange, scope: PrizeScope): { heads: DigitAbsence[]; tails: DigitAbsence[] } {
  const make = () => Array.from({ length: 10 }, (_, digit) => ({ digit, absentDraws: 0, currentStreak: 0, maxStreak: 0 }))
  const heads = make()
  const tails = make()
  const [start, end] = scopeSlots(scope)

  const update = (s: DigitAbsence, present: boolean) => {
    if (present) {
      s.currentStreak = 0
      return
    }
    s.absentDraws++
    s.currentStreak++
    if (s.currentStreak > s.maxStreak) s.maxStreak = s.currentStreak
  }

  for (let draw = range.from; draw < range.to; draw++) {
    let headMask = 0
    let tailMask = 0
    const base = draw * SLOTS_PER_DRAW
    for (let slot = start; slot < end; slot++) {
      const n = ds.numbers[base + slot]
      headMask |= 1 << head(n)
      tailMask |= 1 << tail(n)
    }
    for (let d = 0; d < 10; d++) {
      update(heads[d], (headMask & (1 << d)) !== 0)
      update(tails[d], (tailMask & (1 << d)) !== 0)
    }
  }

  return { heads, tails }
}

/** P(a given head, or tail, digit is missing from one draw) under a uniform model. */
export function digitAbsenceProbability(scope: PrizeScope): number {
  return 0.9 ** slotsPerDraw(scope)
}

/** Probability that head + tail = s (0–18) for a uniformly random number 00–99. */
export function digitSumProbability(s: number): number {
  if (s < 0 || s > 18) return 0
  return (s <= 9 ? s + 1 : 19 - s) / NUMBER_COUNT
}

export interface SumHistogram {
  /** observed[s] = hits with head + tail = s, s in 0..18. */
  observed: Uint32Array
  /** expected[s] = total × P(sum = s). */
  expected: number[]
  /** Hits by "tổng" as used in lô đề: (head + tail) mod 10. */
  observedMod10: Uint32Array
  total: number
  chiSquare: ChiSquareResult
}

export interface ChiSquareResult {
  statistic: number
  degreesOfFreedom: number
  /** P(χ² ≥ statistic) under the null hypothesis that the draws follow the expected distribution. */
  pValue: number
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

/** ln Γ(x) via the Lanczos approximation (g = 7). */
function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  let a = LANCZOS[0]
  const t = x + 7.5
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Regularized upper incomplete gamma Q(a, x) (series for small x, Lentz continued fraction otherwise). */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1
  const logPrefix = -x + a * Math.log(x) - logGamma(a)
  if (x < a + 1) {
    let term = 1 / a
    let sum = term
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break
    }
    return Math.max(0, 1 - sum * Math.exp(logPrefix))
  }
  const tiny = 1e-300
  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-15) break
  }
  return Math.min(1, Math.exp(logPrefix) * h)
}

/** Upper-tail probability of the chi-square distribution. */
export function chiSquarePValue(statistic: number, degreesOfFreedom: number): number {
  if (degreesOfFreedom <= 0) return 1
  return gammaQ(degreesOfFreedom / 2, statistic / 2)
}

/** Pearson's chi-square statistic between observed counts and expected counts. */
export function chiSquare(observed: ArrayLike<number>, expected: ArrayLike<number>): ChiSquareResult {
  let statistic = 0
  let bins = 0
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] <= 0) continue
    statistic += (observed[i] - expected[i]) ** 2 / expected[i]
    bins++
  }
  const degreesOfFreedom = Math.max(0, bins - 1)
  return { statistic, degreesOfFreedom, pValue: chiSquarePValue(statistic, degreesOfFreedom) }
}

export function digitSumHistogram(freq: FrequencyResult): SumHistogram {
  const observed = new Uint32Array(19)
  const observedMod10 = new Uint32Array(10)
  for (let n = 0; n < NUMBER_COUNT; n++) {
    const s = head(n) + tail(n)
    observed[s] += freq.counts[n]
    observedMod10[s % 10] += freq.counts[n]
  }
  const expected = Array.from({ length: 19 }, (_, s) => freq.total * digitSumProbability(s))
  return { observed, expected, observedMod10, total: freq.total, chiSquare: chiSquare(observed, expected) }
}

// ---------------------------------------------------------------------------
// Chẵn / Lẻ, Tài / Xỉu trend
// ---------------------------------------------------------------------------

export type TrendBucket = 'draw' | 'month' | 'quarter' | 'year'

export interface TrendPoint {
  label: string
  /** Numbers whose value is even / odd. */
  even: number
  odd: number
  /** Tài = 50–99, Xỉu = 00–49. */
  big: number
  small: number
  total: number
}

/** Picks a bucket size that yields a readable number of points for the range length. */
export function autoBucket(draws: number): TrendBucket {
  if (draws <= 150) return 'draw'
  if (draws <= 1100) return 'month'
  if (draws <= 3000) return 'quarter'
  return 'year'
}

function bucketKey(date: string, bucket: TrendBucket): string {
  switch (bucket) {
    case 'draw':
      return date
    case 'month':
      return date.slice(0, 7)
    case 'quarter':
      return `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`
    case 'year':
      return date.slice(0, 4)
  }
}

export function parityTrend(ds: Dataset, range: DrawRange, scope: PrizeScope, bucket: TrendBucket): TrendPoint[] {
  const points: TrendPoint[] = []
  const [start, end] = scopeSlots(scope)
  let current: TrendPoint | null = null

  for (let draw = range.from; draw < range.to; draw++) {
    const label = bucketKey(ds.dates[draw], bucket)
    if (current === null || current.label !== label) {
      current = { label, even: 0, odd: 0, big: 0, small: 0, total: 0 }
      points.push(current)
    }
    const base = draw * SLOTS_PER_DRAW
    for (let slot = start; slot < end; slot++) {
      const n = ds.numbers[base + slot]
      if (n % 2 === 0) current.even++
      else current.odd++
      if (n >= 50) current.big++
      else current.small++
      current.total++
    }
  }

  return points
}

// ---------------------------------------------------------------------------
// Cặp số đi cùng nhau (co-occurrence / lô xiên 2)
// ---------------------------------------------------------------------------

export interface CooccurrenceMatrix {
  /** pairs[a * 100 + b] = draws on which both a and b appeared (symmetric, diagonal = 0). */
  pairs: Uint32Array
  /** daysPresent[n] = draws on which n appeared. */
  daysPresent: Uint32Array
  draws: number
}

/**
 * Counts, for every pair of numbers, the draws on which both appeared (the day-level equivalent of
 * multiplying rows of xsmb-sparse.json). With scope 'special' there is one number per draw, so all
 * pair counts are 0.
 */
export function computeCooccurrence(ds: Dataset, range: DrawRange, scope: PrizeScope): CooccurrenceMatrix {
  const pairs = new Uint32Array(NUMBER_COUNT * NUMBER_COUNT)
  const daysPresent = new Uint32Array(NUMBER_COUNT)
  const seen = new Uint8Array(NUMBER_COUNT)
  const present: number[] = []
  const [start, end] = scopeSlots(scope)

  for (let draw = range.from; draw < range.to; draw++) {
    const base = draw * SLOTS_PER_DRAW
    for (let slot = start; slot < end; slot++) {
      const n = ds.numbers[base + slot]
      if (!seen[n]) {
        seen[n] = 1
        present.push(n)
      }
    }
    for (let i = 0; i < present.length; i++) {
      const a = present[i]
      daysPresent[a]++
      for (let j = i + 1; j < present.length; j++) {
        const b = present[j]
        pairs[a * NUMBER_COUNT + b]++
        pairs[b * NUMBER_COUNT + a]++
      }
      seen[a] = 0
    }
    present.length = 0
  }

  return { pairs, daysPresent, draws: Math.max(0, range.to - range.from) }
}

export interface PairStat {
  a: number
  b: number
  /** Draws on which both numbers appeared. */
  count: number
  /** count / draws. */
  support: number
  /** Expected count if the two numbers were independent: draws × P(a) × P(b). */
  expected: number
  /** count / expected (> 1: appear together more often than chance). */
  lift: number
}

function pairStat(m: CooccurrenceMatrix, a: number, b: number): PairStat {
  const count = m.pairs[a * NUMBER_COUNT + b]
  const expected = m.draws > 0 ? (m.daysPresent[a] * m.daysPresent[b]) / m.draws : 0
  return {
    a,
    b,
    count,
    support: m.draws > 0 ? count / m.draws : 0,
    expected,
    lift: expected > 0 ? count / expected : 0,
  }
}

export type PairRanking = 'count' | 'lift'

const PAIR_SORTERS: Record<PairRanking, (x: PairStat, y: PairStat) => number> = {
  count: (x, y) => y.count - x.count || y.lift - x.lift || x.a - y.a || x.b - y.b,
  lift: (x, y) => y.lift - x.lift || y.count - x.count || x.a - y.a || x.b - y.b,
}

/**
 * Top pairs a < b, ranked by days together ('count') or by how much they beat independence ('lift').
 * Pairs with fewer than `minCount` shared days are skipped; use it with 'lift', where rare pairs
 * otherwise dominate by chance.
 */
export function rankPairs(m: CooccurrenceMatrix, limit: number, by: PairRanking = 'count', minCount = 1): PairStat[] {
  const all: PairStat[] = []
  for (let a = 0; a < NUMBER_COUNT; a++) {
    for (let b = a + 1; b < NUMBER_COUNT; b++) {
      if (m.pairs[a * NUMBER_COUNT + b] >= Math.max(1, minCount)) all.push(pairStat(m, a, b))
    }
  }
  all.sort(PAIR_SORTERS[by])
  return all.slice(0, limit)
}

/** The numbers that most often appeared on the same day as `n`. */
export function partnersOf(m: CooccurrenceMatrix, n: number, limit: number): PairStat[] {
  const result: PairStat[] = []
  for (let other = 0; other < NUMBER_COUNT; other++) {
    if (other !== n) result.push(pairStat(m, n, other))
  }
  result.sort((x, y) => y.count - x.count || y.lift - x.lift || x.b - y.b)
  return result.slice(0, limit)
}

export interface PairNetwork {
  nodes: { number: number; daysPresent: number; degree: number }[]
  edges: PairStat[]
}

/**
 * Graph data for the network chart: the `edgeLimit` top pairs (see rankPairs) and the numbers they touch.
 * Showing all 4,950 edges would be unreadable, so only the top pairs are kept.
 */
export function buildPairNetwork(m: CooccurrenceMatrix, edgeLimit: number, by: PairRanking = 'count', minCount = 1): PairNetwork {
  const edges = rankPairs(m, edgeLimit, by, minCount)
  const degree = new Map<number, number>()
  for (const e of edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1)
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1)
  }
  const nodes = [...degree.entries()]
    .sort(([x], [y]) => x - y)
    .map(([number, deg]) => ({ number, daysPresent: m.daysPresent[number], degree: deg }))
  return { nodes, edges }
}
