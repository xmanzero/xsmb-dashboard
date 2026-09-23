/**
 * Advanced statistics for the extra dashboard tabs: Markov "bạc nhớ", reversed pairs, lô rơi từ đề,
 * bệt streaks, weekday / lunar-calendar patterns, 5-digit special prize analysis, PCA, xiên 3 and a
 * betting backtest engine.
 *
 * Every function is pure and returns, next to the observed figures, what a fair random draw would
 * give (expected counts, baseline rates, theoretical return), so the UI can show both side by side.
 * Conventions follow utils/lotteryStats.ts: ranges are half-open [from, to) draw indexes.
 */

import { SLOTS_PER_DRAW, type Dataset } from '../services/dataLoader.ts'
import {
  chiSquare,
  NUMBER_COUNT,
  scopeSlots,
  slotsPerDraw,
  type ChiSquareResult,
  type DrawRange,
  type PrizeScope,
} from './lotteryStats.ts'

// ---------------------------------------------------------------------------
// Presence matrix (the in-memory equivalent of xsmb-sparse.json)
// ---------------------------------------------------------------------------

export interface Presence {
  /** Dataset index of the first row. */
  from: number
  /** Number of draws (rows). */
  draws: number
  /** hits[t * 100 + n] = times n was drawn on row t (0 = absent). */
  hits: Uint8Array
  /** present[t] = numbers drawn at least once on row t, ascending. */
  present: Uint8Array[]
}

export function buildPresence(ds: Dataset, range: DrawRange, scope: PrizeScope = 'all'): Presence {
  const draws = Math.max(0, range.to - range.from)
  const hits = new Uint8Array(draws * NUMBER_COUNT)
  const present: Uint8Array[] = []
  const [start, end] = scopeSlots(scope)
  for (let t = 0; t < draws; t++) {
    const base = (range.from + t) * SLOTS_PER_DRAW
    const row = t * NUMBER_COUNT
    for (let slot = start; slot < end; slot++) hits[row + ds.numbers[base + slot]]++
    const list: number[] = []
    for (let n = 0; n < NUMBER_COUNT; n++) if (hits[row + n] > 0) list.push(n)
    present.push(Uint8Array.from(list))
  }
  return { from: range.from, draws, hits, present }
}

/** Draws on which each number appeared at least once. */
export function daysPresent(p: Presence): Uint32Array {
  const days = new Uint32Array(NUMBER_COUNT)
  for (const list of p.present) for (const n of list) days[n]++
  return days
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// ---------------------------------------------------------------------------
// 1. Bạc nhớ: first-order Markov transitions between consecutive draws
// ---------------------------------------------------------------------------

export interface TransitionMatrix {
  /** counts[i * 100 + j] = consecutive draw pairs (t, t+1) with i drawn on t and j drawn on t+1. */
  counts: Uint32Array
  /** Σ_k counts(i, k). */
  rowTotals: Float64Array
  /** Draws t (with a following draw) on which i appeared. */
  sourceDays: Uint32Array
  /** Draws t+1 on which j appeared. */
  targetDays: Uint32Array
  /** Number of (t, t+1) pairs. */
  transitions: number
}

/** C(i, j) over the sets S_t → S_{t+1} of consecutive draws (each number counted once per draw). */
export function markovTransitions(p: Presence): TransitionMatrix {
  const counts = new Uint32Array(NUMBER_COUNT * NUMBER_COUNT)
  const rowTotals = new Float64Array(NUMBER_COUNT)
  const sourceDays = new Uint32Array(NUMBER_COUNT)
  const targetDays = new Uint32Array(NUMBER_COUNT)
  const transitions = Math.max(0, p.draws - 1)

  for (let t = 0; t < transitions; t++) {
    const today = p.present[t]
    const tomorrow = p.present[t + 1]
    for (const j of tomorrow) targetDays[j]++
    for (const i of today) {
      sourceDays[i]++
      rowTotals[i] += tomorrow.length
      const row = i * NUMBER_COUNT
      for (const j of tomorrow) counts[row + j]++
    }
  }
  return { counts, rowTotals, sourceDays, targetDays, transitions }
}

export interface NextNumber {
  number: number
  /** C(i, j). */
  count: number
  /** P(j | i) = C(i, j) / Σ_k C(i, k): j's share of everything drawn the day after i. */
  probability: number
  /** P(j drawn on t+1 | i drawn on t) = C(i, j) / days with i. */
  conditionalRate: number
  /** P(j drawn on any following day), regardless of i. */
  baselineRate: number
  /** conditionalRate / baselineRate; ≈ 1 means i tells nothing about j. */
  lift: number
}

/** The `limit` numbers most often drawn the day after `i`. */
export function topNextNumbers(m: TransitionMatrix, i: number, limit: number): NextNumber[] {
  const row = i * NUMBER_COUNT
  const result: NextNumber[] = []
  for (let j = 0; j < NUMBER_COUNT; j++) {
    const count = m.counts[row + j]
    const conditionalRate = m.sourceDays[i] ? count / m.sourceDays[i] : 0
    const baselineRate = m.transitions ? m.targetDays[j] / m.transitions : 0
    result.push({
      number: j,
      count,
      probability: m.rowTotals[i] ? count / m.rowTotals[i] : 0,
      conditionalRate,
      baselineRate,
      lift: baselineRate ? conditionalRate / baselineRate : 0,
    })
  }
  result.sort((a, b) => b.count - a.count || b.lift - a.lift || a.number - b.number)
  return result.slice(0, limit)
}

// ---------------------------------------------------------------------------
// 2. Cặp số lộn (XY – YX)
// ---------------------------------------------------------------------------

/** 12 → 21, 5 → 50; doubles (00, 11, …) map to themselves. */
export function reverseNumber(n: number): number {
  return (n % 10) * 10 + Math.floor(n / 10)
}

export interface ReversePairStat {
  a: number
  b: number
  /** Draws with both a and b. */
  both: number
  onlyA: number
  onlyB: number
  neither: number
  /** Draws with both if a and b were independent: draws × P(a) × P(b). */
  expectedBoth: number
}

/** The 45 pairs (XY, YX) with X < Y, doubles excluded. */
export function reversePairStats(p: Presence): ReversePairStat[] {
  const result: ReversePairStat[] = []
  const days = daysPresent(p)
  for (let a = 0; a < NUMBER_COUNT; a++) {
    const b = reverseNumber(a)
    if (b <= a) continue
    let both = 0
    for (let t = 0; t < p.draws; t++) {
      const row = t * NUMBER_COUNT
      if (p.hits[row + a] && p.hits[row + b]) both++
    }
    const onlyA = days[a] - both
    const onlyB = days[b] - both
    result.push({
      a,
      b,
      both,
      onlyA,
      onlyB,
      neither: p.draws - both - onlyA - onlyB,
      expectedBoth: p.draws ? (days[a] * days[b]) / p.draws : 0,
    })
  }
  return result
}

// ---------------------------------------------------------------------------
// 3. Lô rơi từ đề and bệt streaks
// ---------------------------------------------------------------------------

export interface CarryStats {
  /** Pairs of consecutive draws in the range. */
  trials: number
  /** Times the đề of day t came out again among the 27 lô of day t+1. */
  hits: number
  rate: number
  /** P(a given number appears in 27 draws) = 1 − 0.99^27 ≈ 23.8%. */
  expectedRate: number
  /** [missed, came back once, came back 2+ times (nháy)]. */
  byHits: [number, number, number]
}

export function specialToLotoCarry(ds: Dataset, range: DrawRange): CarryStats {
  const byHits: [number, number, number] = [0, 0, 0]
  let trials = 0
  for (let t = range.from; t + 1 < range.to; t++) {
    const de = ds.numbers[t * SLOTS_PER_DRAW]
    const next = (t + 1) * SLOTS_PER_DRAW
    let count = 0
    for (let slot = 0; slot < SLOTS_PER_DRAW; slot++) if (ds.numbers[next + slot] === de) count++
    byHits[Math.min(count, 2)]++
    trials++
  }
  const hits = byHits[1] + byHits[2]
  return { trials, hits, rate: trials ? hits / trials : 0, expectedRate: 1 - 0.99 ** SLOTS_PER_DRAW, byHits }
}

export interface StreakStats {
  /** histogram[k] = runs of exactly k consecutive draws (index 0 unused). */
  histogram: number[]
  /** Expected runs of length k if appearances were independent with the observed rate. */
  expected: number[]
  totalRuns: number
  /** Observed P(a number is drawn on a given day). */
  presenceRate: number
  /** Longest run; the most recent one wins a tie. */
  record: { number: number; length: number; endDate: string } | null
  /** Numbers on a run of 2+ draws up to the end of the range, longest first. */
  current: { number: number; length: number }[]
}

/** Bệt: runs of consecutive draws on which a number appeared. */
export function streakStats(ds: Dataset, p: Presence): StreakStats {
  const histogram: number[] = [0]
  let totalRuns = 0
  let presentCells = 0
  let record: StreakStats['record'] = null
  const current: StreakStats['current'] = []

  const addRun = (n: number, length: number, endRow: number) => {
    while (histogram.length <= length) histogram.push(0)
    histogram[length]++
    totalRuns++
    if (!record || length >= record.length) record = { number: n, length, endDate: ds.dates[p.from + endRow] }
  }

  for (let n = 0; n < NUMBER_COUNT; n++) {
    let run = 0
    for (let t = 0; t < p.draws; t++) {
      if (p.hits[t * NUMBER_COUNT + n]) {
        run++
        presentCells++
      } else if (run) {
        addRun(n, run, t - 1)
        run = 0
      }
    }
    if (run) {
      addRun(n, run, p.draws - 1)
      if (run >= 2) current.push({ number: n, length: run })
    }
  }

  const q = p.draws ? presentCells / (p.draws * NUMBER_COUNT) : 0
  // Independent draws: a run continues with probability q, so P(length = k) = q^(k−1) (1 − q).
  const expected = histogram.map((_, k) => (k === 0 ? 0 : totalRuns * q ** (k - 1) * (1 - q)))
  current.sort((a, b) => b.length - a.length || a.number - b.number)
  return { histogram, expected, totalRuns, presenceRate: q, record, current }
}

// ---------------------------------------------------------------------------
// 4. Weekday and province (đài) patterns
// ---------------------------------------------------------------------------

export const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

/** Province that hosts the XSMB draw on each weekday (0 = Sunday). */
export const STATION_BY_WEEKDAY = ['Thái Bình', 'Hà Nội', 'Quảng Ninh', 'Bắc Ninh', 'Hà Nội', 'Hải Phòng', 'Nam Định'] as const

/** Weekdays Monday first, as on a Vietnamese calendar. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" date, independent of the viewer's time zone. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export interface WeekdayFrequency {
  /** counts[n * 7 + day] = hits of n on that weekday. */
  counts: Uint32Array
  /** Draws held on each weekday. */
  drawsByDay: Uint32Array
  /** rates[n * 7 + day] = counts / drawsByDay: average hits of n per draw on that weekday. */
  rates: Float64Array
  /** Average hits per number per draw for a fair draw: slots / 100 (0.27 for lô, 0.01 for đề). */
  expectedRate: number
}

export function weekdayFrequency(ds: Dataset, range: DrawRange, scope: PrizeScope): WeekdayFrequency {
  const counts = new Uint32Array(NUMBER_COUNT * 7)
  const drawsByDay = new Uint32Array(7)
  const [start, end] = scopeSlots(scope)
  for (let t = range.from; t < range.to; t++) {
    const day = weekdayOf(ds.dates[t])
    drawsByDay[day]++
    const base = t * SLOTS_PER_DRAW
    for (let slot = start; slot < end; slot++) counts[ds.numbers[base + slot] * 7 + day]++
  }
  const rates = new Float64Array(NUMBER_COUNT * 7)
  for (let i = 0; i < rates.length; i++) rates[i] = drawsByDay[i % 7] ? counts[i] / drawsByDay[i % 7] : 0
  return { counts, drawsByDay, rates, expectedRate: slotsPerDraw(scope) / NUMBER_COUNT }
}

export function topByWeekday(w: WeekdayFrequency, day: number, limit: number): { number: number; count: number; rate: number }[] {
  return Array.from({ length: NUMBER_COUNT }, (_, n) => ({ number: n, count: w.counts[n * 7 + day], rate: w.rates[n * 7 + day] }))
    .sort((a, b) => b.rate - a.rate || a.number - b.number)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// 5. Lunar calendar (Vietnamese, UTC+7) — Hồ Ngọc Đức's astronomical algorithm
// ---------------------------------------------------------------------------

export interface LunarDate {
  day: number
  month: number
  year: number
  leap: boolean
}

const VN_TIME_ZONE = 7

/** Julian day number of a Gregorian date. */
function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  return dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
}

/** Julian date of the k-th new moon after 1900-01-01 (Meeus, simplified). */
function newMoon(k: number): number {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const dr = Math.PI / 180
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  c1 = c1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  c1 = c1 - 0.0004 * Math.sin(dr * 3 * Mpr)
  c1 = c1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  c1 = c1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  c1 = c1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  c1 = c1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  const deltaT = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2
  return jd1 + c1 - deltaT
}

/** Sun's ecliptic longitude (radians, 0..2π) at a Julian date. */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525
  const T2 = T * T
  const dr = Math.PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  const L = (L0 + DL) * dr
  return L - Math.PI * 2 * Math.floor(L / (Math.PI * 2))
}

function newMoonDay(k: number, tz: number): number {
  return Math.floor(newMoon(k) + 0.5 + tz / 24)
}

/** Sun longitude sector 0..11 (each 30°) at local midnight starting `dayNumber`. */
function sunLongitudeSector(dayNumber: number, tz: number): number {
  return Math.floor((sunLongitude(dayNumber - 0.5 - tz / 24) / Math.PI) * 6)
}

/** Day number of the start of lunar month 11 (the month containing the winter solstice) of `yy`. */
function lunarMonth11(yy: number, tz: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = Math.floor(off / 29.530588853)
  const nm = newMoonDay(k, tz)
  return sunLongitudeSector(nm, tz) >= 9 ? newMoonDay(k - 1, tz) : nm
}

/** Index (after month 11) of the leap month in a 13-month lunar year. */
function leapMonthOffset(a11: number, tz: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let i = 1
  let arc = sunLongitudeSector(newMoonDay(k + i, tz), tz)
  let last: number
  do {
    last = arc
    i++
    arc = sunLongitudeSector(newMoonDay(k + i, tz), tz)
  } while (arc !== last && i < 14)
  return i - 1
}

/** Converts a solar "YYYY-MM-DD" date to the Vietnamese lunar calendar. */
export function solarToLunar(date: string, tz = VN_TIME_ZONE): LunarDate {
  const [yy, mm, dd] = date.split('-').map(Number)
  const dayNumber = jdFromDate(dd, mm, yy)
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = newMoonDay(k + 1, tz)
  if (monthStart > dayNumber) monthStart = newMoonDay(k, tz)

  let a11 = lunarMonth11(yy, tz)
  let b11 = a11
  let year: number
  if (a11 >= monthStart) {
    year = yy
    a11 = lunarMonth11(yy - 1, tz)
  } else {
    year = yy + 1
    b11 = lunarMonth11(yy + 1, tz)
  }

  const day = dayNumber - monthStart + 1
  const diff = Math.floor((monthStart - a11) / 29)
  let leap = false
  let month = diff + 11
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11, tz)
    if (diff >= leapDiff) {
      month = diff + 10
      if (diff === leapDiff) leap = true
    }
  }
  if (month > 12) month -= 12
  if (month >= 11 && diff < 4) year -= 1
  return { day, month, year, leap }
}

const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ']
const CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi']

/** Can Chi name of a lunar year, e.g. 2026 → "Bính Ngọ". */
export function canChiYear(year: number): string {
  return `${CAN[year % 10]} ${CHI[year % 12]}`
}

export type LunarMarker = 'mung1' | 'ram' | 'cuoiThang'

export const LUNAR_MARKER_LABELS: Record<LunarMarker, string> = {
  mung1: 'Mùng 1',
  ram: 'Rằm (15)',
  cuoiThang: 'Cuối tháng',
}

function nextSolarDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** Special lunar days a solar date falls on (the last day of a lunar month is the day before a mùng 1). */
export function lunarMarkers(date: string): LunarMarker[] {
  const lunar = solarToLunar(date)
  const markers: LunarMarker[] = []
  if (lunar.day === 1) markers.push('mung1')
  if (lunar.day === 15) markers.push('ram')
  if (solarToLunar(nextSolarDay(date)).day === 1) markers.push('cuoiThang')
  return markers
}

export interface LunarDayFrequency {
  draws: number
  /** Dataset indexes of those draws. */
  indexes: number[]
  /** Hits of each number on draws of this kind. */
  counts: Uint32Array
}

/** Frequency of every number on mùng 1, rằm and the last day of lunar months. */
export function lunarDayFrequency(ds: Dataset, range: DrawRange, scope: PrizeScope): Record<LunarMarker, LunarDayFrequency> {
  const result: Record<LunarMarker, LunarDayFrequency> = {
    mung1: { draws: 0, indexes: [], counts: new Uint32Array(NUMBER_COUNT) },
    ram: { draws: 0, indexes: [], counts: new Uint32Array(NUMBER_COUNT) },
    cuoiThang: { draws: 0, indexes: [], counts: new Uint32Array(NUMBER_COUNT) },
  }
  const [start, end] = scopeSlots(scope)
  for (let t = range.from; t < range.to; t++) {
    const markers = lunarMarkers(ds.dates[t])
    if (!markers.length) continue
    const base = t * SLOTS_PER_DRAW
    for (const marker of markers) {
      const entry = result[marker]
      entry.draws++
      entry.indexes.push(t)
      for (let slot = start; slot < end; slot++) entry.counts[ds.numbers[base + slot]]++
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// 6. Giải đặc biệt, 5 digits
// ---------------------------------------------------------------------------

/** The five digits d1..d5 of a special prize (leading zeros kept). */
export function specialDigits(special: number): [number, number, number, number, number] {
  return [
    Math.floor(special / 10000) % 10,
    Math.floor(special / 1000) % 10,
    Math.floor(special / 100) % 10,
    Math.floor(special / 10) % 10,
    special % 10,
  ]
}

/** Specials of the draws in `range`, skipping missing values (< 0). */
function specialsIn(specials: ArrayLike<number>, range: DrawRange): number[] {
  const result: number[] = []
  for (let t = range.from; t < range.to; t++) if (specials[t] >= 0) result.push(specials[t])
  return result
}

/** Frequency of the càng digit (d3, hundreds) of the special prize. */
export function cangDistribution(specials: ArrayLike<number>, range: DrawRange): { counts: Uint32Array; total: number; chiSquare: ChiSquareResult } {
  const counts = new Uint32Array(10)
  const values = specialsIn(specials, range)
  for (const s of values) counts[specialDigits(s)[2]]++
  return { counts, total: values.length, chiSquare: chiSquare(counts, Array(10).fill(values.length / 10)) }
}

let digitSumPmfCache: number[] | null = null

/** Exact P(d1 + … + d5 = s), s = 0..45, for five independent uniform digits. */
export function digitSum5Pmf(): number[] {
  if (digitSumPmfCache) return digitSumPmfCache
  let pmf = [1]
  for (let d = 0; d < 5; d++) {
    const next = Array<number>(pmf.length + 9).fill(0)
    pmf.forEach((p, s) => {
      for (let digit = 0; digit <= 9; digit++) next[s + digit] += p / 10
    })
    pmf = next
  }
  digitSumPmfCache = pmf
  return pmf
}

/** Merges adjacent bins until each expected count is ≥ 5, as the chi-square test requires. */
function pooledChiSquare(observed: ArrayLike<number>, expected: readonly number[]): ChiSquareResult {
  const obs: number[] = []
  const exp: number[] = []
  let o = 0
  let e = 0
  for (let i = 0; i < expected.length; i++) {
    o += observed[i]
    e += expected[i]
    if (e >= 5) {
      obs.push(o)
      exp.push(e)
      o = 0
      e = 0
    }
  }
  if (e > 0 && exp.length) {
    obs[obs.length - 1] += o
    exp[exp.length - 1] += e
  }
  return chiSquare(obs, exp)
}

export interface Sum5Distribution {
  /** observed[s] = specials whose digit sum is s (0..45). */
  observed: Uint32Array
  /** Exact expected counts (convolution of five uniform digits). */
  expected: number[]
  /** Normal approximation N(22.5, 41.25) scaled to the sample, for the Gauss curve. */
  normal: number[]
  total: number
  mean: number | null
  /** Sample standard deviation. */
  std: number | null
  /** Tested against the exact distribution, with sparse tail bins pooled. */
  chiSquare: ChiSquareResult
}

export function sum5Distribution(specials: ArrayLike<number>, range: DrawRange): Sum5Distribution {
  const observed = new Uint32Array(46)
  const sums = specialsIn(specials, range).map((s) => specialDigits(s).reduce((a, b) => a + b, 0))
  for (const s of sums) observed[s]++
  const total = sums.length
  const pmf = digitSum5Pmf()
  const mu = 22.5
  const sigma = Math.sqrt(5 * 8.25)
  const m = mean(sums)
  const std = m === null || total < 2 ? null : Math.sqrt(sums.reduce((acc, s) => acc + (s - m) ** 2, 0) / (total - 1))
  return {
    observed,
    expected: pmf.map((p) => p * total),
    normal: pmf.map((_, s) => (total * Math.exp(-((s - mu) ** 2) / (2 * sigma * sigma))) / (sigma * Math.sqrt(2 * Math.PI))),
    total,
    mean: m,
    std,
    chiSquare: pooledChiSquare(observed, pmf.map((p) => p * total)),
  }
}

export type SpecialPattern = 'kepBang' | 'kepLech' | 'kepAm' | 'ganh' | 'tien'

export const SPECIAL_PATTERN_LABELS: Record<SpecialPattern | 'thuong', string> = {
  kepBang: 'Kép bằng (…xx)',
  kepLech: 'Kép lệch (bóng dương)',
  kepAm: 'Kép âm (bóng âm)',
  ganh: 'Số gánh (đối xứng)',
  tien: 'Số tiến',
  thuong: 'Số thường',
}

/** Bóng âm pairs: 0–7, 1–4, 2–9, 3–6, 5–8. */
const BONG_AM = [7, 4, 9, 6, 1, 8, 3, 0, 5, 2]

/**
 * Patterns of a special prize:
 * - kép bằng: d4 = d5; kép lệch: |d4 − d5| = 5 (bóng dương); kép âm: d5 = bóng âm of d4;
 * - gánh: d1 = d5 and d2 = d4; tiến: d1 < d2 < d3 < d4 < d5.
 */
export function specialPatterns(special: number): SpecialPattern[] {
  const [d1, d2, d3, d4, d5] = specialDigits(special)
  const patterns: SpecialPattern[] = []
  if (d4 === d5) patterns.push('kepBang')
  if (Math.abs(d4 - d5) === 5) patterns.push('kepLech')
  if (BONG_AM[d4] === d5) patterns.push('kepAm')
  if (d1 === d5 && d2 === d4) patterns.push('ganh')
  if (d1 < d2 && d2 < d3 && d3 < d4 && d4 < d5) patterns.push('tien')
  return patterns
}

/** Priority used to give every special exactly one category (for a pie chart). */
export const PATTERN_PRIORITY: readonly SpecialPattern[] = ['ganh', 'tien', 'kepBang', 'kepLech', 'kepAm']

export function exclusivePattern(special: number): SpecialPattern | 'thuong' {
  const patterns = specialPatterns(special)
  return PATTERN_PRIORITY.find((p) => patterns.includes(p)) ?? 'thuong'
}

type PatternCounts<K extends string> = Record<K, number>

let patternProbabilityCache: { flags: PatternCounts<SpecialPattern>; exclusive: PatternCounts<SpecialPattern | 'thuong'> } | null = null

/** Exact probabilities of each pattern, by enumerating all 100,000 specials once. */
export function patternProbabilities() {
  if (patternProbabilityCache) return patternProbabilityCache
  const flags: PatternCounts<SpecialPattern> = { kepBang: 0, kepLech: 0, kepAm: 0, ganh: 0, tien: 0 }
  const exclusive: PatternCounts<SpecialPattern | 'thuong'> = { ...flags, thuong: 0 }
  for (let s = 0; s < 100_000; s++) {
    for (const p of specialPatterns(s)) flags[p] += 1e-5
    exclusive[exclusivePattern(s)] += 1e-5
  }
  patternProbabilityCache = { flags, exclusive }
  return patternProbabilityCache
}

export interface PatternStats {
  total: number
  /** Count of specials showing each pattern (a special can show several). */
  flags: PatternCounts<SpecialPattern>
  /** Count per exclusive category (sums to total). */
  exclusive: PatternCounts<SpecialPattern | 'thuong'>
  probabilities: ReturnType<typeof patternProbabilities>
}

export function specialPatternStats(specials: ArrayLike<number>, range: DrawRange): PatternStats {
  const flags: PatternCounts<SpecialPattern> = { kepBang: 0, kepLech: 0, kepAm: 0, ganh: 0, tien: 0 }
  const exclusive: PatternCounts<SpecialPattern | 'thuong'> = { ...flags, thuong: 0 }
  const values = specialsIn(specials, range)
  for (const s of values) {
    for (const p of specialPatterns(s)) flags[p]++
    exclusive[exclusivePattern(s)]++
  }
  return { total: values.length, flags, exclusive, probabilities: patternProbabilities() }
}

export interface BaoKepStats {
  /** Draws in the range whose first two digits match (d1 = d2): the "báo kép" signal. */
  signals: number
  /** Draws from each signal until the next kép bằng (d4 = d5); signals with no kép afterwards are censored. */
  delays: number[]
  censored: number
  mean: number | null
  median: number | null
  /** The same waiting time measured from every draw in the range, signal or not. */
  baselineMean: number | null
  /** 1 / P(kép bằng) = 10 draws for a fair draw. */
  theoreticalMean: number
}

/** Does d1 = d2 announce an earlier kép bằng? Compares the wait after signals with the wait from any day. */
export function baoKepDelay(specials: ArrayLike<number>, range: DrawRange): BaoKepStats {
  const size = specials.length
  // nextKep[t] = first draw index ≥ t with d4 = d5, or −1.
  const nextKep = new Int32Array(size + 1).fill(-1)
  for (let t = size - 1; t >= 0; t--) {
    const s = specials[t]
    nextKep[t] = s >= 0 && s % 10 === Math.floor(s / 10) % 10 ? t : nextKep[t + 1]
  }
  const delays: number[] = []
  const baseline: number[] = []
  let signals = 0
  let censored = 0
  for (let t = range.from; t < range.to; t++) {
    const s = specials[t]
    if (s < 0) continue
    const next = t + 1 < size ? nextKep[t + 1] : -1
    if (next >= 0) baseline.push(next - t)
    const [d1, d2] = specialDigits(s)
    if (d1 !== d2) continue
    signals++
    if (next >= 0) delays.push(next - t)
    else censored++
  }
  return { signals, delays, censored, mean: mean(delays), median: median(delays), baselineMean: mean(baseline), theoreticalMean: 10 }
}

// ---------------------------------------------------------------------------
// 7. PCA (power iteration with deflation)
// ---------------------------------------------------------------------------

/**
 * Top `k` eigenpairs of a symmetric n×n matrix (row-major) by power iteration with deflation.
 * The input is not modified. Eigenvectors are unit length, sign-fixed so the largest component is positive.
 */
export function topEigenpairs(matrix: Float64Array, n: number, k: number, maxIterations = 2000, tolerance = 1e-12) {
  const a = Float64Array.from(matrix)
  const pairs: { value: number; vector: Float64Array }[] = []
  for (let c = 0; c < k; c++) {
    // Deterministic, non-degenerate start vector.
    let v = Float64Array.from({ length: n }, (_, i) => 1 + ((i * 7919) % 97) / 97)
    let value = 0
    for (let iter = 0; iter < maxIterations; iter++) {
      const w = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        let sum = 0
        const row = i * n
        for (let j = 0; j < n; j++) sum += a[row + j] * v[j]
        w[i] = sum
      }
      const norm = Math.hypot(...w)
      if (norm === 0) break
      for (let i = 0; i < n; i++) w[i] /= norm
      let change = 0
      for (let i = 0; i < n; i++) change = Math.max(change, Math.abs(w[i] - v[i]))
      v = w
      value = norm
      if (change < tolerance) break
    }
    let largest = 0
    for (let i = 0; i < n; i++) if (Math.abs(v[i]) > Math.abs(v[largest])) largest = i
    if (v[largest] < 0) for (let i = 0; i < n; i++) v[i] = -v[i]
    pairs.push({ value, vector: v })
    // Deflate: A ← A − λ v vᵀ.
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a[i * n + j] -= value * v[i] * v[j]
  }
  return pairs
}

export interface PcaResult {
  /** Position of each number: √λ_k · v_k[n] for the two main components. */
  coords: { number: number; x: number; y: number }[]
  eigenvalues: [number, number]
  /** Share of the total variance explained by each component. */
  explained: [number, number]
}

/**
 * Covariance between the 100 numbers' daily hit series (Cov = B Bᵀ / N with each series centred),
 * then its two leading eigenvectors. Numbers that tend to come out on the same days end up close.
 *
 * The coordinates are the component loadings √λ·v. Treating numbers as samples instead (projecting each
 * centred series onto the principal axes) gives the same picture up to a constant factor.
 */
export function pca2d(p: Presence): PcaResult {
  const n = NUMBER_COUNT
  const N = Math.max(1, p.draws)
  const sums = new Float64Array(n)
  const products = new Float64Array(n * n)
  for (let t = 0; t < p.draws; t++) {
    const row = t * n
    const list = p.present[t]
    for (const i of list) {
      const hi = p.hits[row + i]
      sums[i] += hi
      for (const j of list) products[i * n + j] += hi * p.hits[row + j]
    }
  }
  const cov = new Float64Array(n * n)
  let trace = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) cov[i * n + j] = products[i * n + j] / N - (sums[i] / N) * (sums[j] / N)
    trace += cov[i * n + i]
  }
  const [first, second] = topEigenpairs(cov, n, 2)
  return {
    coords: Array.from({ length: n }, (_, i) => ({
      number: i,
      x: Math.sqrt(Math.max(0, first.value)) * first.vector[i],
      y: Math.sqrt(Math.max(0, second.value)) * second.vector[i],
    })),
    eigenvalues: [first.value, second.value],
    explained: trace > 0 ? [first.value / trace, second.value / trace] : [0, 0],
  }
}

/**
 * Share of the total variance the largest principal component reaches by chance alone, for
 * `variables` independent series observed `samples` times (Marchenko–Pastur upper edge:
 * λ_max ≈ σ² (1 + √(variables / samples))²). A real structure has to stand clearly above this.
 */
export function randomTopComponentShare(variables: number, samples: number): number {
  if (samples <= 0 || variables <= 0) return 0
  return (1 + Math.sqrt(variables / samples)) ** 2 / variables
}

// ---------------------------------------------------------------------------
// 8. Xiên 3 (frequent triplets)
// ---------------------------------------------------------------------------

/** The `limit` numbers present on the most draws (ties: smaller number first). */
export function hottestNumbers(p: Presence, limit: number): number[] {
  const days = daysPresent(p)
  return Array.from({ length: NUMBER_COUNT }, (_, n) => n)
    .sort((a, b) => days[b] - days[a] || a - b)
    .slice(0, limit)
}

function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

export interface TripletStat {
  numbers: [number, number, number]
  /** Draws with all three numbers. */
  count: number
  support: number
  /** Expected draws with all three if independent: draws × P(a) × P(b) × P(c). */
  expected: number
  lift: number
}

/** Counts every 3-combination of `candidates` drawn together, using bitsets over the draws. */
export function frequentTriplets(p: Presence, candidates: readonly number[], limit: number): TripletStat[] {
  const words = Math.ceil(p.draws / 32)
  const days = daysPresent(p)
  const bits = candidates.map((n) => {
    const set = new Uint32Array(words)
    for (let t = 0; t < p.draws; t++) if (p.hits[t * NUMBER_COUNT + n]) set[t >>> 5] |= 1 << (t & 31)
    return set
  })
  const result: TripletStat[] = []
  for (let x = 0; x < candidates.length; x++) {
    for (let y = x + 1; y < candidates.length; y++) {
      const xy = new Uint32Array(words)
      for (let w = 0; w < words; w++) xy[w] = bits[x][w] & bits[y][w]
      for (let z = y + 1; z < candidates.length; z++) {
        let count = 0
        for (let w = 0; w < words; w++) count += popcount(xy[w] & bits[z][w])
        const [a, b, c] = [candidates[x], candidates[y], candidates[z]].sort((u, v) => u - v)
        const expected = p.draws ? (days[a] * days[b] * days[c]) / p.draws ** 2 : 0
        result.push({ numbers: [a, b, c], count, support: p.draws ? count / p.draws : 0, expected, lift: expected ? count / expected : 0 })
      }
    }
  }
  result.sort(
    (u, v) =>
      v.count - u.count ||
      v.lift - u.lift ||
      u.numbers[0] - v.numbers[0] ||
      u.numbers[1] - v.numbers[1] ||
      u.numbers[2] - v.numbers[2],
  )
  return result.slice(0, limit)
}

// ---------------------------------------------------------------------------
// 9. Backtesting betting strategies
// ---------------------------------------------------------------------------

export interface BettingOdds {
  /** Cost of 1 point of lô (VNĐ). */
  lotoCostPerPoint: number
  /** Payout of 1 point of lô for each time the number comes out (VNĐ). */
  lotoPayoutPerPoint: number
  /** Đề pays this multiple of the stake. */
  dePayoutMultiplier: number
}

export const DEFAULT_ODDS: BettingOdds = { lotoCostPerPoint: 23_000, lotoPayoutPerPoint: 80_000, dePayoutMultiplier: 70 }

export type Strategy =
  /** Lô on the number most often drawn the day after yesterday's đề (learned only from earlier draws). */
  | { kind: 'markov'; points: number }
  /** Lô on the longest-missing number once its gan exceeds `threshold`, until it comes out. */
  | { kind: 'ganChase'; threshold: number; points: number; progression: 'flat' | 'martingale'; multiplier: number; maxSteps: number }
  /** Đề on a fixed set of numbers every draw. */
  | { kind: 'deSet'; numbers: readonly number[]; stakePerNumber: number }

/** Dàn chạm: every number containing one of the digits (2 digits → 36 numbers). */
export function touchSet(digits: readonly number[]): number[] {
  return Array.from({ length: NUMBER_COUNT }, (_, n) => n).filter((n) => digits.includes(Math.floor(n / 10)) || digits.includes(n % 10))
}

/** Dàn tổng: every number whose (đầu + đuôi) mod 10 is one of `sums` (10 numbers per sum). */
export function sumSet(sums: readonly number[]): number[] {
  return Array.from({ length: NUMBER_COUNT }, (_, n) => n).filter((n) => sums.includes((Math.floor(n / 10) + (n % 10)) % 10))
}

/** Expected payout per VNĐ staked for a fair draw (the house keeps the rest). */
export function theoreticalReturn(strategy: Strategy, odds: BettingOdds = DEFAULT_ODDS): number {
  if (strategy.kind === 'deSet') return odds.dePayoutMultiplier / NUMBER_COUNT
  // Expected hits of one lô number per draw = 27 / 100, each paying lotoPayoutPerPoint.
  return ((SLOTS_PER_DRAW / NUMBER_COUNT) * odds.lotoPayoutPerPoint) / odds.lotoCostPerPoint
}

export interface BacktestDay {
  date: string
  /** Balance after settling the draw. */
  balance: number
  stake: number
  payout: number
  /** Numbers bet on this draw. */
  numbers: number[]
}

export interface BacktestResult {
  days: BacktestDay[]
  initialCapital: number
  finalBalance: number
  netProfit: number
  totalStaked: number
  totalWon: number
  betDays: number
  winDays: number
  /** winDays / betDays. */
  winRate: number
  /** Largest peak-to-trough fall of the balance, as a fraction of the peak. */
  maxDrawdown: number
  maxDrawdownAmount: number
  /** First draw the strategy could not afford its stake; betting stops there. */
  bankruptDate: string | null
  /** totalWon / totalStaked. */
  returnToPlayer: number
  theoreticalReturn: number
}

function countIn(ds: Dataset, draw: number, n: number): number {
  let count = 0
  const base = draw * SLOTS_PER_DRAW
  for (let slot = 0; slot < SLOTS_PER_DRAW; slot++) if (ds.numbers[base + slot] === n) count++
  return count
}

/**
 * Simulates a strategy draw by draw over `range`. Decisions for a draw only use results of earlier
 * draws (the warm-up before the range included), so there is no look-ahead bias.
 */
export function runBacktest(ds: Dataset, range: DrawRange, strategy: Strategy, initialCapital: number, odds: BettingOdds = DEFAULT_ODDS): BacktestResult {
  const days: BacktestDay[] = []
  let balance = initialCapital
  let totalStaked = 0
  let totalWon = 0
  let betDays = 0
  let winDays = 0
  let bankruptDate: string | null = null

  // --- Strategy state, warmed up on the draws before the range.
  const deToLoto = new Uint32Array(NUMBER_COUNT * NUMBER_COUNT)
  const learnDeToLoto = (t: number) => {
    if (t < 1) return
    const row = ds.numbers[(t - 1) * SLOTS_PER_DRAW] * NUMBER_COUNT
    const seen = new Set<number>()
    for (let slot = 0; slot < SLOTS_PER_DRAW; slot++) seen.add(ds.numbers[t * SLOTS_PER_DRAW + slot])
    for (const j of seen) deToLoto[row + j]++
  }
  const lastSeen = new Int32Array(NUMBER_COUNT).fill(-1)
  const see = (t: number) => {
    for (let slot = 0; slot < SLOTS_PER_DRAW; slot++) lastSeen[ds.numbers[t * SLOTS_PER_DRAW + slot]] = t
  }
  for (let t = 0; t < range.from; t++) {
    if (strategy.kind === 'markov') learnDeToLoto(t)
    if (strategy.kind === 'ganChase') see(t)
  }
  let chase: { number: number; step: number } | null = null
  const deSet = strategy.kind === 'deSet' ? new Set(strategy.numbers) : null

  for (let t = range.from; t < range.to; t++) {
    // --- Decide the bet from past draws only.
    let numbers: number[] = []
    let stake = 0
    if (strategy.kind === 'markov' && t >= 1) {
      const row = ds.numbers[(t - 1) * SLOTS_PER_DRAW] * NUMBER_COUNT
      let best = -1
      for (let j = 0; j < NUMBER_COUNT; j++) if (deToLoto[row + j] > 0 && (best < 0 || deToLoto[row + j] > deToLoto[row + best])) best = j
      if (best >= 0) {
        numbers = [best]
        stake = strategy.points * odds.lotoCostPerPoint
      }
    } else if (strategy.kind === 'ganChase') {
      if (!chase) {
        let best = 0
        for (let n = 1; n < NUMBER_COUNT; n++) if (lastSeen[n] < lastSeen[best]) best = n
        if (t - 1 - lastSeen[best] > strategy.threshold) chase = { number: best, step: 0 }
      }
      if (chase) {
        const factor = strategy.progression === 'martingale' ? strategy.multiplier ** chase.step : 1
        numbers = [chase.number]
        stake = Math.round(strategy.points * factor) * odds.lotoCostPerPoint
      }
    } else if (strategy.kind === 'deSet') {
      numbers = [...strategy.numbers]
      stake = strategy.stakePerNumber * numbers.length
    }

    if (bankruptDate || stake > balance) {
      if (!bankruptDate && stake > 0) bankruptDate = ds.dates[t]
      numbers = []
      stake = 0
    }

    // --- Settle against the actual draw.
    let payout = 0
    if (stake > 0) {
      if (strategy.kind === 'deSet') {
        if (deSet!.has(ds.numbers[t * SLOTS_PER_DRAW])) payout = strategy.stakePerNumber * odds.dePayoutMultiplier
      } else {
        const points = stake / odds.lotoCostPerPoint
        payout = countIn(ds, t, numbers[0]) * points * odds.lotoPayoutPerPoint
      }
      balance += payout - stake
      totalStaked += stake
      totalWon += payout
      betDays++
      if (payout > 0) winDays++
    }

    // --- Update the strategy state with this draw.
    if (strategy.kind === 'markov') learnDeToLoto(t)
    if (strategy.kind === 'ganChase') {
      if (chase && stake > 0) {
        if (payout > 0) chase = null
        else if (++chase.step >= strategy.maxSteps) chase = null
      }
      see(t)
    }

    days.push({ date: ds.dates[t], balance, stake, payout, numbers })
  }

  let peak = initialCapital
  let maxDrawdown = 0
  let maxDrawdownAmount = 0
  for (const d of days) {
    peak = Math.max(peak, d.balance)
    if (peak - d.balance > maxDrawdownAmount) maxDrawdownAmount = peak - d.balance
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - d.balance) / peak)
  }

  return {
    days,
    initialCapital,
    finalBalance: balance,
    netProfit: balance - initialCapital,
    totalStaked,
    totalWon,
    betDays,
    winDays,
    winRate: betDays ? winDays / betDays : 0,
    maxDrawdown,
    maxDrawdownAmount,
    bankruptDate,
    returnToPlayer: totalStaked ? totalWon / totalStaked : 0,
    theoreticalReturn: theoreticalReturn(strategy, odds),
  }
}
