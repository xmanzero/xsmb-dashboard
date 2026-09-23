import { describe, expect, it } from 'vitest'

import { PRIZE_GROUPS, PRIZE_KEYS, SLOT_GROUPS, alignSpecials, formatPrize, numberAt, parseDataset } from './dataLoader.ts'

function record(date: string, special: number) {
  return { date: `${date}T00:00:00.000`, ...Object.fromEntries(PRIZE_KEYS.map((k) => [k, 1])), special }
}

describe('parseDataset', () => {
  it('sorts by date and strips the time part', () => {
    const ds = parseDataset([record('2024-01-02', 22), record('2024-01-01', 11)])
    expect(ds.dates).toEqual(['2024-01-01', '2024-01-02'])
    expect(numberAt(ds, 0, 0)).toBe(11)
    expect(numberAt(ds, 1, 0)).toBe(22)
    expect(ds.size).toBe(2)
  })

  it('rejects values outside 0–99, duplicate dates and empty input', () => {
    expect(() => parseDataset([record('2024-01-01', 100)])).toThrow(/2024-01-01/)
    expect(() => parseDataset([record('2024-01-01', 1), record('2024-01-01', 2)])).toThrow(/trùng/)
    expect(() => parseDataset([])).toThrow()
    expect(() => parseDataset({})).toThrow()
  })
})

describe('alignSpecials', () => {
  it('matches specials to dataset dates and marks gaps', () => {
    const ds = parseDataset([record('2024-01-01', 1), record('2024-01-02', 2), record('2024-01-03', 3)])
    const specials = alignSpecials(ds, [['2024-01-03', 31922], ['2024-01-01T00:00:00.000', 1234], ['2024-01-02', 100_000]])
    expect(Array.from(specials)).toEqual([1234, -1, 31922])
    expect(() => alignSpecials(ds, {})).toThrow()
  })
})

describe('prize groups', () => {
  it('covers the 27 slots in order', () => {
    expect(SLOT_GROUPS).toHaveLength(27)
    expect(SLOT_GROUPS[0].short).toBe('ĐB')
    expect(SLOT_GROUPS[26].short).toBe('G7')
  })

  it('pads prizes to their digit count', () => {
    const g4 = PRIZE_GROUPS.find((g) => g.short === 'G4')!
    expect(formatPrize(g4, 334)).toBe('0334')
  })
})
