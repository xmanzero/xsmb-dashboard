import { describe, expect, it } from 'vitest'

import { SLOTS_PER_DRAW, type Dataset } from '../services/dataLoader.ts'
import {
  buildOccurrenceIndex,
  chiSquarePValue,
  computeCooccurrence,
  computeCycle,
  computeGanStats,
  countDaysPresent,
  countFrequency,
  countMultiHits,
  digitAbsence,
  digitDistribution,
  digitSumHistogram,
  digitSumProbability,
  gapDistribution,
  lotoTable,
  mutedDigits,
  parityTrend,
  partnersOf,
  probabilityPerDraw,
  rankNumbers,
  rankPairs,
  resolveRange,
  shiftYears,
} from './lotteryStats.ts'

/** Filler for the prize slots a test does not care about. */
const FILL = 99

/**
 * Builds a dataset from draws given as [special, ...other prizes]; missing slots are FILL.
 * Dates are consecutive days from `start` unless given explicitly.
 */
function makeDataset(draws: number[][], start = '2024-01-01', dates?: string[]): Dataset {
  const numbers = new Uint8Array(draws.length * SLOTS_PER_DRAW).fill(FILL)
  draws.forEach((draw, i) => numbers.set(draw, i * SLOTS_PER_DRAW))
  const t0 = Date.parse(`${start}T00:00:00Z`)
  return {
    dates: dates ?? draws.map((_, i) => new Date(t0 + i * 86_400_000).toISOString().slice(0, 10)),
    numbers,
    size: draws.length,
  }
}

const full = (ds: Dataset) => ({ from: 0, to: ds.size })

describe('shiftYears', () => {
  it('moves the year and clamps 29 February', () => {
    expect(shiftYears('2026-09-22', -1)).toBe('2025-09-22')
    expect(shiftYears('2024-02-29', -1)).toBe('2023-02-28')
    expect(shiftYears('2024-02-29', -4)).toBe('2020-02-29')
  })
})

describe('resolveRange', () => {
  const ds = makeDataset(Array.from({ length: 10 }, () => [0]))

  it('selects the last N draws', () => {
    expect(resolveRange(ds, { kind: 'lastDraws', count: 3 })).toEqual({ from: 7, to: 10 })
    expect(resolveRange(ds, { kind: 'lastDraws', count: 50 })).toEqual({ from: 0, to: 10 })
  })

  it('selects everything', () => {
    expect(resolveRange(ds, { kind: 'all' })).toEqual({ from: 0, to: 10 })
  })

  it('uses (last − years, last] like the Python analysis', () => {
    const dated = makeDataset([[0], [0], [0], [0]], '', ['2023-01-04', '2023-01-05', '2023-01-06', '2024-01-05'])
    // 2023-01-05 is exactly one year before the last draw and is excluded.
    expect(resolveRange(dated, { kind: 'lastYears', years: 1 })).toEqual({ from: 2, to: 4 })
  })

  it('handles custom ranges, including swapped and empty ones', () => {
    expect(resolveRange(ds, { kind: 'custom', start: '2024-01-03', end: '2024-01-05' })).toEqual({ from: 2, to: 5 })
    expect(resolveRange(ds, { kind: 'custom', start: '2024-01-05', end: '2024-01-03' })).toEqual({ from: 2, to: 5 })
    const empty = resolveRange(ds, { kind: 'custom', start: '2030-01-01', end: '2030-12-31' })
    expect(empty.to - empty.from).toBe(0)
  })
})

describe('countFrequency', () => {
  const ds = makeDataset([
    [12, 34, 12],
    [34, 12],
  ])

  it('counts every hit of the 27 prizes', () => {
    const f = countFrequency(ds, full(ds), 'all')
    expect(f.counts[12]).toBe(3)
    expect(f.counts[34]).toBe(2)
    expect(f.counts[FILL]).toBe(2 * SLOTS_PER_DRAW - 5)
    expect(f.total).toBe(2 * SLOTS_PER_DRAW)
    expect(f.expected).toBeCloseTo(0.54)
  })

  it('counts only the special prize in the Đề scope', () => {
    const f = countFrequency(ds, full(ds), 'special')
    expect(f.counts[12]).toBe(1)
    expect(f.counts[34]).toBe(1)
    expect(f.total).toBe(2)
  })

  it('ranks with a stable tie-break on the smaller number', () => {
    const f = countFrequency(ds, full(ds), 'all')
    expect(rankNumbers(f.counts, 3)).toEqual([
      { number: FILL, value: 49 },
      { number: 12, value: 3 },
      { number: 34, value: 2 },
    ])
    expect(rankNumbers(f.counts, 2, 'asc').map((r) => r.number)).toEqual([0, 1])
  })
})

describe('occurrence index, gan and nhịp', () => {
  // Special prize: 5 at draws 0, 3 and 9; 8 only at draw 11; 7 never. 12 draws in total.
  const specials = [5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 8]
  const ds = makeDataset(specials.map((s) => [s]))
  const index = buildOccurrenceIndex(ds, 'special')
  const gan = computeGanStats(ds, index, full(ds))

  it('lists the draws each number appeared on', () => {
    expect(Array.from(index.draws[5])).toEqual([0, 3, 9])
    expect(countDaysPresent(index, full(ds))[5]).toBe(3)
    expect(countDaysPresent(index, { from: 1, to: 9 })[5]).toBe(1)
  })

  it('computes current and record gan', () => {
    expect(gan[5]).toMatchObject({ current: 2, max: 5, maxEndDate: ds.dates[9], lastSeen: ds.dates[9], alert: false })
    expect(gan[5].ratio).toBeCloseTo(0.4)
  })

  it('treats a number that never appeared as an ongoing record', () => {
    expect(gan[7]).toMatchObject({ current: 12, max: 12, maxEndDate: null, lastSeen: null, alert: true, appearances: 0 })
  })

  it('does not count the censored drought before the first appearance', () => {
    expect(gan[8]).toMatchObject({ current: 0, max: 0, alert: false })
  })

  it('raises an alert at the threshold ratio', () => {
    // 5 appears at 0 and 6 (gap 5), then the range ends 4 draws after the last one: 4 / 5 = 0.8.
    const alertDs = makeDataset([5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1].map((s) => [s]))
    const stats = computeGanStats(alertDs, buildOccurrenceIndex(alertDs, 'special'), full(alertDs), 0.8)
    expect(stats[5]).toMatchObject({ current: 4, max: 5, alert: true })
  })

  it('computes nhịp rơi statistics', () => {
    const cycle = computeCycle(ds, index, 5, full(ds))
    expect(cycle.gaps).toEqual([3, 6])
    expect(cycle.meanGap).toBe(4.5)
    expect(cycle.medianGap).toBe(4.5)
    expect(cycle.maxGap).toBe(6)
    expect(cycle.currentGan).toBe(2)
    expect(cycle.expectedGap).toBeCloseTo(100)
    expect(cycle.points.map((p) => p.gap)).toEqual([null, 3, 6])
  })

  it('counts nháy (several hits in one draw)', () => {
    const multi = makeDataset([[12, 12, 12], [12], [3, 3]])
    const counts = countMultiHits(buildOccurrenceIndex(multi, 'all'), full(multi))
    expect(counts[12]).toBe(1)
    expect(counts[3]).toBe(1)
    expect(buildOccurrenceIndex(multi, 'all').hits[12][0]).toBe(3)
  })
})

describe('probabilities', () => {
  it('uses 1 − 0.99^27 for lô and 1% for đề', () => {
    expect(probabilityPerDraw('all')).toBeCloseTo(1 - 0.99 ** 27)
    expect(probabilityPerDraw('special')).toBeCloseTo(0.01)
  })

  it('digit sums form a distribution', () => {
    const total = Array.from({ length: 19 }, (_, s) => digitSumProbability(s)).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1)
    expect(digitSumProbability(9)).toBeCloseTo(0.1)
    expect(digitSumProbability(0)).toBeCloseTo(0.01)
    expect(digitSumProbability(19)).toBe(0)
  })

  it('chi-square p-values match reference values', () => {
    expect(chiSquarePValue(3.841459, 1)).toBeCloseTo(0.05, 6)
    expect(chiSquarePValue(18.307038, 10)).toBeCloseTo(0.05, 6)
    // Exact closed form for even degrees of freedom: e^(−x/2) Σ (x/2)^k / k!, k < df/2.
    const x = 12
    let term = 1
    let sum = 1
    for (let k = 1; k < 9; k++) sum += (term *= x / 2 / k)
    expect(chiSquarePValue(x, 18)).toBeCloseTo(Math.exp(-x / 2) * sum, 10)
    expect(chiSquarePValue(0, 5)).toBe(1)
  })

  it('geometric gap bins sum to the number of gaps', () => {
    const gaps = [1, 1, 2, 5, 9, 30]
    const bins = gapDistribution(gaps, 0.2, 2, 5)
    expect(bins.map((b) => b.observed)).toEqual([3, 0, 1, 0, 2])
    expect(bins.reduce((s, b) => s + b.expected, 0)).toBeCloseTo(gaps.length)
    expect(bins[4]).toMatchObject({ from: 9, to: null })
  })
})

describe('đầu / đuôi / chạm / tổng', () => {
  const ds = makeDataset([[55, 12, 90]])

  it('splits hits by head, tail and touch', () => {
    const d = digitDistribution(countFrequency(ds, full(ds), 'special'))
    expect(d.heads[5]).toBe(1)
    expect(d.tails[5]).toBe(1)
    // 55 contains the digit 5 twice but counts once for chạm 5.
    expect(d.touches[5]).toBe(1)
  })

  it('builds the sum histogram', () => {
    const h = digitSumHistogram(countFrequency(ds, full(ds), 'special'))
    expect(h.observed[10]).toBe(1)
    expect(h.observedMod10[0]).toBe(1)
    expect(h.expected.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('builds the đầu–đuôi table and muted digits of a draw', () => {
    const table = lotoTable(ds, 0)
    expect(table[5].tails).toEqual([5])
    expect(table[9].tails).toEqual([0, ...Array(24).fill(9)])
    const muted = mutedDigits(ds, 0)
    expect(muted.heads).toEqual([0, 2, 3, 4, 6, 7, 8])
    expect(muted.tails).toEqual([1, 3, 4, 6, 7, 8])
  })

  it('tracks absent-digit streaks', () => {
    const streakDs = makeDataset([[10], [20], [30], [10]])
    const { heads } = digitAbsence(streakDs, full(streakDs), 'special')
    expect(heads[1]).toMatchObject({ absentDraws: 2, currentStreak: 0, maxStreak: 2 })
    expect(heads[3]).toMatchObject({ absentDraws: 3, currentStreak: 1, maxStreak: 2 })
    expect(heads[5]).toMatchObject({ absentDraws: 4, currentStreak: 4, maxStreak: 4 })
  })
})

describe('parityTrend', () => {
  it('buckets draws by month', () => {
    const ds = makeDataset([[2], [3], [60]], '', ['2024-01-30', '2024-01-31', '2024-02-01'])
    const points = parityTrend(ds, full(ds), 'special', 'month')
    expect(points).toEqual([
      { label: '2024-01', even: 1, odd: 1, big: 0, small: 2, total: 2 },
      { label: '2024-02', even: 1, odd: 0, big: 1, small: 0, total: 1 },
    ])
  })
})

describe('co-occurrence', () => {
  // FILL (99) is in every draw, so it pairs with everything; 1 and 2 share two draws.
  const ds = makeDataset([
    [1, 2, 2],
    [1, 2, 3],
    [1, 3],
    [4],
  ])
  const m = computeCooccurrence(ds, full(ds), 'all')

  it('counts days two numbers appeared together, ignoring repeats', () => {
    expect(m.pairs[1 * 100 + 2]).toBe(2)
    expect(m.pairs[2 * 100 + 1]).toBe(2)
    expect(m.pairs[1 * 100 + 3]).toBe(2)
    expect(m.pairs[2 * 100 + 2]).toBe(0)
    expect(m.daysPresent[1]).toBe(3)
    expect(m.daysPresent[FILL]).toBe(4)
  })

  it('has no pairs for the special prize alone', () => {
    const special = computeCooccurrence(ds, full(ds), 'special')
    expect(special.pairs.every((c) => c === 0)).toBe(true)
  })

  it('ranks pairs by count, or by lift with a minimum support', () => {
    const top = rankPairs(m, 3)
    expect(top[0]).toMatchObject({ a: 1, b: FILL, count: 3 })
    const pair12 = rankPairs(m, 10).find((p) => p.a === 1 && p.b === 2)!
    // Independence: 4 draws × (3/4) × (2/4) = 1.5 expected days.
    expect(pair12.expected).toBeCloseTo(1.5)
    expect(pair12.lift).toBeCloseTo(2 / 1.5)
    expect(rankPairs(m, 10, 'lift', 2).every((p) => p.count >= 2)).toBe(true)
  })

  it('lists the partners of a number', () => {
    expect(partnersOf(m, 2, 2).map((p) => p.b)).toEqual([1, FILL])
  })
})
