import { describe, expect, it } from 'vitest'

import { SLOTS_PER_DRAW, type Dataset } from '../services/dataLoader.ts'
import {
  baoKepDelay,
  buildPresence,
  canChiYear,
  cangDistribution,
  digitSum5Pmf,
  exclusivePattern,
  frequentTriplets,
  hottestNumbers,
  lunarDayFrequency,
  lunarMarkers,
  markovTransitions,
  patternProbabilities,
  pca2d,
  randomTopComponentShare,
  reverseNumber,
  reversePairStats,
  runBacktest,
  solarToLunar,
  specialDigits,
  specialPatterns,
  specialToLotoCarry,
  streakStats,
  sum5Distribution,
  sumSet,
  theoreticalReturn,
  topEigenpairs,
  topNextNumbers,
  touchSet,
  weekdayFrequency,
  weekdayOf,
} from './advancedStats.ts'

const FILL = 99

/** Draws given as [special, ...other prizes]; missing slots are FILL. Consecutive days from `start`. */
function makeDataset(draws: number[][], start = '2024-01-01'): Dataset {
  const numbers = new Uint8Array(draws.length * SLOTS_PER_DRAW).fill(FILL)
  draws.forEach((draw, i) => numbers.set(draw, i * SLOTS_PER_DRAW))
  const t0 = Date.parse(`${start}T00:00:00Z`)
  return { dates: draws.map((_, i) => new Date(t0 + i * 86_400_000).toISOString().slice(0, 10)), numbers, size: draws.length }
}

const full = (ds: Dataset) => ({ from: 0, to: ds.size })

describe('presence and Markov transitions', () => {
  const ds = makeDataset([[1, 2], [3, 1], [1, 4]])
  const p = buildPresence(ds, full(ds))

  it('lists the distinct numbers of every draw', () => {
    expect(Array.from(p.present[0])).toEqual([1, 2, FILL])
    expect(p.hits[FILL]).toBe(SLOTS_PER_DRAW - 2)
  })

  it('counts C(i, j) over consecutive draws', () => {
    const m = markovTransitions(p)
    expect(m.transitions).toBe(2)
    // 1 → {3, 1, 99} and 1 → {1, 4, 99}: 1 is followed by itself twice.
    expect(m.counts[1 * 100 + 1]).toBe(2)
    expect(m.counts[1 * 100 + 3]).toBe(1)
    expect(m.counts[2 * 100 + 4]).toBe(0)
    expect(m.sourceDays[1]).toBe(2)
    expect(m.rowTotals[1]).toBe(6)
    const [top] = topNextNumbers(m, 1, 3)
    expect(top.number).toBe(1)
    expect(top.probability).toBeCloseTo(2 / 6)
    expect(top.conditionalRate).toBe(1)
    expect(top.baselineRate).toBe(1)
  })
})

describe('reversed pairs', () => {
  it('maps XY to YX and lists the 45 non-double pairs', () => {
    expect(reverseNumber(12)).toBe(21)
    expect(reverseNumber(5)).toBe(50)
    expect(reverseNumber(33)).toBe(33)
    const ds = makeDataset([[12, 21], [12], [21], [0]])
    const stats = reversePairStats(buildPresence(ds, full(ds)))
    expect(stats).toHaveLength(45)
    expect(stats.find((s) => s.a === 12)).toMatchObject({ b: 21, both: 1, onlyA: 1, onlyB: 1, neither: 1 })
  })
})

describe('lô rơi từ đề and bệt', () => {
  it('counts the đề coming back the next day, with nháy', () => {
    const ds = makeDataset([[7], [3, 7], [5, 3, 3], [8]])
    const carry = specialToLotoCarry(ds, full(ds))
    expect(carry.trials).toBe(3)
    expect(carry.byHits).toEqual([1, 1, 1])
    expect(carry.rate).toBeCloseTo(2 / 3)
    expect(carry.expectedRate).toBeCloseTo(1 - 0.99 ** 27)
  })

  it('measures runs of consecutive draws', () => {
    const ds = makeDataset([[5], [5], [5], [1], [5], [5]])
    const s = streakStats(ds, buildPresence(ds, full(ds), 'special'))
    // Number 5: runs of 3 and 2 (current); number 1: run of 1.
    expect(s.histogram).toEqual([0, 1, 1, 1])
    expect(s.record).toMatchObject({ number: 5, length: 3, endDate: ds.dates[2] })
    expect(s.current).toEqual([{ number: 5, length: 2 }])
    expect(s.expected.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(s.totalRuns)
  })
})

describe('calendar', () => {
  it('finds the weekday in UTC', () => {
    expect(weekdayOf('2026-09-22')).toBe(2) // Tuesday
    expect(weekdayOf('2024-01-07')).toBe(0) // Sunday
  })

  it('normalises weekday frequency by the number of draws of that weekday', () => {
    const ds = makeDataset([[1], [1], [2], [3], [4], [5], [6], [1]], '2024-01-01') // Mon…Mon
    const w = weekdayFrequency(ds, full(ds), 'special')
    expect(w.drawsByDay[1]).toBe(2)
    expect(w.counts[1 * 7 + 1]).toBe(2)
    expect(w.rates[1 * 7 + 1]).toBe(1)
    expect(w.expectedRate).toBeCloseTo(0.01)
  })

  it('converts known Tết (lunar new year) dates', () => {
    for (const date of ['2005-02-09', '2020-01-25', '2023-01-22', '2024-02-10', '2025-01-29', '2026-02-17']) {
      expect(solarToLunar(date)).toMatchObject({ day: 1, month: 1, year: Number(date.slice(0, 4)), leap: false })
    }
    // The day before Tết 2026 is the last day of month 12 of the previous lunar year.
    expect(solarToLunar('2026-02-16')).toMatchObject({ month: 12, year: 2025 })
    expect(lunarMarkers('2026-02-16')).toEqual(['cuoiThang'])
    expect(lunarMarkers('2026-02-17')).toEqual(['mung1'])
  })

  it('handles leap months (2023 had a leap 2nd month)', () => {
    expect(solarToLunar('2023-03-22')).toMatchObject({ day: 1, month: 2, leap: true })
    expect(solarToLunar('2023-02-20')).toMatchObject({ day: 1, month: 2, leap: false })
  })

  it('counts numbers on mùng 1 draws', () => {
    const ds = makeDataset([[42], [7]], '2024-02-09') // 9 Feb = last day of the year, 10 Feb = Tết
    const f = lunarDayFrequency(ds, full(ds), 'special')
    expect(f.cuoiThang).toMatchObject({ draws: 1 })
    expect(f.cuoiThang.counts[42]).toBe(1)
    expect(f.mung1.counts[7]).toBe(1)
    expect(f.mung1.indexes).toEqual([1])
  })

  it('names lunar years', () => {
    expect(canChiYear(2026)).toBe('Bính Ngọ')
    expect(canChiYear(2024)).toBe('Giáp Thìn')
    expect(canChiYear(2005)).toBe('Ất Dậu')
  })
})

describe('special prize (5 digits)', () => {
  it('splits digits with leading zeros', () => {
    expect(specialDigits(1234)).toEqual([0, 1, 2, 3, 4])
    expect(specialDigits(31922)).toEqual([3, 1, 9, 2, 2])
  })

  it('counts the càng digit', () => {
    const c = cangDistribution([31922, 10500, -1], { from: 0, to: 3 })
    expect(c.total).toBe(2)
    expect(c.counts[9]).toBe(1)
    expect(c.counts[5]).toBe(1)
  })

  it('has an exact digit-sum distribution', () => {
    const pmf = digitSum5Pmf()
    expect(pmf).toHaveLength(46)
    expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(pmf[0]).toBeCloseTo(1e-5)
    expect(pmf[22]).toBeCloseTo(pmf[23])
    const d = sum5Distribution([99999, 0], { from: 0, to: 2 })
    expect(d.observed[45]).toBe(1)
    expect(d.observed[0]).toBe(1)
    expect(d.mean).toBe(22.5)
  })

  it('classifies patterns', () => {
    expect(specialPatterns(31922)).toEqual(['kepBang'])
    expect(specialPatterns(12305)).toEqual(['kepLech'])
    expect(specialPatterns(12307)).toEqual(['kepAm'])
    expect(specialPatterns(12321)).toEqual(['ganh'])
    expect(specialPatterns(1234)).toEqual(['tien'])
    // 11311 is both gánh and kép bằng; gánh wins the exclusive category.
    expect(exclusivePattern(11311)).toBe('ganh')
    expect(exclusivePattern(12345)).toBe('tien')
    expect(exclusivePattern(12340)).toBe('thuong')
  })

  it('knows the exact pattern probabilities', () => {
    const p = patternProbabilities()
    expect(p.flags.kepBang).toBeCloseTo(0.1)
    expect(p.flags.kepLech).toBeCloseTo(0.1)
    expect(p.flags.kepAm).toBeCloseTo(0.1)
    expect(p.flags.ganh).toBeCloseTo(0.01)
    expect(p.flags.tien).toBeCloseTo(252 / 100_000)
    expect(Object.values(p.exclusive).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('measures the wait from a báo kép (d1 = d2) to the next kép bằng', () => {
    // index: 0 báo kép, 1 –, 2 kép bằng, 3 báo kép, 4 –
    const specials = [11000, 12345, 12344, 22000, 12345]
    const s = baoKepDelay(specials, { from: 0, to: 5 })
    expect(s.signals).toBe(2)
    expect(s.delays).toEqual([2])
    expect(s.censored).toBe(1)
    expect(s.theoreticalMean).toBe(10)
  })
})

describe('PCA', () => {
  it('finds the eigenpairs of a symmetric matrix', () => {
    // Eigenvalues 3 and 1 with eigenvectors (1, 1)/√2 and (1, −1)/√2.
    const [first, second] = topEigenpairs(Float64Array.from([2, 1, 1, 2]), 2, 2)
    expect(first.value).toBeCloseTo(3)
    expect(Math.abs(first.vector[0])).toBeCloseTo(Math.SQRT1_2)
    expect(second.value).toBeCloseTo(1)
    expect(first.vector[0] * second.vector[0] + first.vector[1] * second.vector[1]).toBeCloseTo(0)
  })

  it('gives the chance level of the top component', () => {
    // 100 variables, 7,500 samples: (1 + √(100/7500))² / 100 ≈ 1.24%.
    expect(randomTopComponentShare(100, 7500)).toBeCloseTo(0.01243, 4)
    expect(randomTopComponentShare(100, 0)).toBe(0)
  })

  it('separates numbers that always come out together', () => {
    // 10 and 20 appear on the same days, 30 on the others.
    const ds = makeDataset([[10, 20], [30], [10, 20], [30], [10, 20], [30]])
    const pca = pca2d(buildPresence(ds, full(ds), 'all'))
    const at = (n: number) => pca.coords[n]
    expect(at(10).x).toBeCloseTo(at(20).x)
    expect(Math.sign(at(10).x)).toBe(-Math.sign(at(30).x))
    expect(pca.explained[0]).toBeGreaterThan(0.9)
  })
})

describe('xiên 3', () => {
  it('counts draws with all three numbers', () => {
    const ds = makeDataset([[1, 2, 3], [1, 2, 3], [1, 2], [4]])
    const p = buildPresence(ds, full(ds))
    expect(hottestNumbers(p, 3)).toEqual([FILL, 1, 2])
    const [top] = frequentTriplets(p, [1, 2, 3, 4], 5)
    expect(top).toMatchObject({ numbers: [1, 2, 3], count: 2 })
    // Independence: 4 × (3/4)(3/4)(2/4) = 1.125 expected draws.
    expect(top.expected).toBeCloseTo(1.125)
  })
})

describe('backtest', () => {
  it('builds dàn chạm and dàn tổng', () => {
    expect(touchSet([3, 8])).toHaveLength(36)
    expect(sumSet([0])).toEqual([0, 19, 28, 37, 46, 55, 64, 73, 82, 91])
  })

  it('knows the house edge', () => {
    expect(theoreticalReturn({ kind: 'deSet', numbers: [1], stakePerNumber: 1000 })).toBeCloseTo(0.7)
    expect(theoreticalReturn({ kind: 'markov', points: 1 })).toBeCloseTo((0.27 * 80) / 23)
  })

  it('settles a dàn đề draw by draw', () => {
    const ds = makeDataset([[5], [6], [5]])
    const r = runBacktest(ds, full(ds), { kind: 'deSet', numbers: [5, 7], stakePerNumber: 1000 }, 10_000)
    // Each draw costs 2,000; draws 0 and 2 pay 70,000.
    expect(r.days.map((d) => d.balance)).toEqual([78_000, 76_000, 144_000])
    expect(r.winRate).toBeCloseTo(2 / 3)
    expect(r.totalStaked).toBe(6000)
    expect(r.maxDrawdownAmount).toBe(2000)
  })

  it('pays lô per nháy and stops when the stake is unaffordable', () => {
    const ds = makeDataset([[1], [2, 1, 1], [3]])
    // markov: after đề 1 (draw 0) comes {2, 1, 99}; draw 2 follows đề 2, never seen before → no bet.
    const r = runBacktest(ds, { from: 1, to: 3 }, { kind: 'markov', points: 1 }, 100_000)
    expect(r.betDays).toBe(0)
    const chase = runBacktest(ds, full(ds), { kind: 'ganChase', threshold: -1, points: 1, progression: 'flat', multiplier: 2, maxSteps: 10 }, 30_000)
    // Draw 0: chases number 0 (never seen), loses 23,000; draw 1: 7,000 left < 23,000 → bankrupt.
    expect(chase.days[0].balance).toBe(7000)
    expect(chase.bankruptDate).toBe(ds.dates[1])
    expect(chase.finalBalance).toBe(7000)
  })

  it('learns bạc nhớ only from earlier draws', () => {
    // Draw 1 teaches "after đề 1 comes 4". Draw 2 follows đề 4, never seen as a đề before, so no bet.
    // Draw 3 follows đề 1 again: the strategy bets 4 and wins twice (nháy).
    const ds = makeDataset([[1], [4], [1], [4, 4]])
    const r = runBacktest(ds, full(ds), { kind: 'markov', points: 1 }, 1_000_000)
    const bets = r.days.filter((d) => d.stake > 0)
    expect(bets.map((d) => d.date)).toEqual([ds.dates[3]])
    expect(bets[0]).toMatchObject({ numbers: [4], payout: 160_000 })
  })
})
