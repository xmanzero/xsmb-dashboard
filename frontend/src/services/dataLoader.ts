/**
 * Loads the XSMB dataset (last two digits of all 27 prizes per draw) once and caches it in memory.
 *
 * The raw JSON (an array of ~7,500 objects with 28 keys each) is converted into a flat Uint8Array,
 * which keeps memory small (~200 KB) and makes the statistics loops in utils/lotteryStats.ts
 * cache-friendly.
 */

/** Prize keys in the order they appear in the data files. Slot 0 is always the special prize (Đề). */
export const PRIZE_KEYS = [
  'special',
  'prize1',
  'prize2_1', 'prize2_2',
  'prize3_1', 'prize3_2', 'prize3_3', 'prize3_4', 'prize3_5', 'prize3_6',
  'prize4_1', 'prize4_2', 'prize4_3', 'prize4_4',
  'prize5_1', 'prize5_2', 'prize5_3', 'prize5_4', 'prize5_5', 'prize5_6',
  'prize6_1', 'prize6_2', 'prize6_3',
  'prize7_1', 'prize7_2', 'prize7_3', 'prize7_4',
] as const

export type PrizeKey = (typeof PRIZE_KEYS)[number]

export const SLOTS_PER_DRAW = PRIZE_KEYS.length // 27

export interface PrizeGroup {
  label: string
  short: string
  keys: readonly PrizeKey[]
  /** Number of digits of each prize in this group. */
  digits: number
}

export const PRIZE_GROUPS: readonly PrizeGroup[] = [
  { label: 'Giải ĐB', short: 'ĐB', keys: ['special'], digits: 5 },
  { label: 'Giải nhất', short: 'G1', keys: ['prize1'], digits: 5 },
  { label: 'Giải nhì', short: 'G2', keys: ['prize2_1', 'prize2_2'], digits: 5 },
  { label: 'Giải ba', short: 'G3', keys: ['prize3_1', 'prize3_2', 'prize3_3', 'prize3_4', 'prize3_5', 'prize3_6'], digits: 5 },
  { label: 'Giải tư', short: 'G4', keys: ['prize4_1', 'prize4_2', 'prize4_3', 'prize4_4'], digits: 4 },
  { label: 'Giải năm', short: 'G5', keys: ['prize5_1', 'prize5_2', 'prize5_3', 'prize5_4', 'prize5_5', 'prize5_6'], digits: 4 },
  { label: 'Giải sáu', short: 'G6', keys: ['prize6_1', 'prize6_2', 'prize6_3'], digits: 3 },
  { label: 'Giải bảy', short: 'G7', keys: ['prize7_1', 'prize7_2', 'prize7_3', 'prize7_4'], digits: 2 },
]

/** Prize group of each slot, e.g. slot 0 -> "Giải ĐB", slot 4 -> "Giải ba". */
export const SLOT_GROUPS: readonly PrizeGroup[] = PRIZE_GROUPS.flatMap((group) => group.keys.map(() => group))

export interface Dataset {
  /** Draw dates as "YYYY-MM-DD", strictly ascending. */
  dates: string[]
  /** Flat array of size `size * SLOTS_PER_DRAW`; value at `draw * 27 + slot` is a number 0–99. */
  numbers: Uint8Array
  /** Number of draws. */
  size: number
}

type RawRecord = { date: string } & Record<PrizeKey, number>

export const DATA_URL = 'data/xsmb-2-digits.json'

/**
 * The data files keep the same URL while their content changes daily, so always revalidate with the
 * server (a cheap 304 when unchanged) instead of trusting the browser or CDN cache.
 */
const FETCH_OPTIONS: RequestInit = { cache: 'no-cache' }

/** Returns the two-digit number drawn in `slot` (0 = special prize) of draw `draw`. */
export function numberAt(ds: Dataset, draw: number, slot: number): number {
  return ds.numbers[draw * SLOTS_PER_DRAW + slot]
}

/** Returns all 27 numbers of one draw (slot order). */
export function drawNumbers(ds: Dataset, draw: number): Uint8Array {
  return ds.numbers.subarray(draw * SLOTS_PER_DRAW, (draw + 1) * SLOTS_PER_DRAW)
}

/** Validates and converts the raw JSON array into a compact Dataset. */
export function parseDataset(raw: unknown): Dataset {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Dữ liệu không hợp lệ: cần một mảng kết quả không rỗng.')
  }

  const records = (raw as RawRecord[])
    .map((r) => ({ ...r, date: String(r.date).slice(0, 10) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const dates: string[] = []
  const numbers = new Uint8Array(records.length * SLOTS_PER_DRAW)

  for (const record of records) {
    const draw = dates.length
    if (draw > 0 && dates[draw - 1] === record.date) {
      throw new Error(`Dữ liệu không hợp lệ: ngày ${record.date} bị trùng.`)
    }
    for (let slot = 0; slot < SLOTS_PER_DRAW; slot++) {
      const value = record[PRIZE_KEYS[slot]]
      if (!Number.isInteger(value) || value < 0 || value > 99) {
        throw new Error(`Dữ liệu không hợp lệ: ${record.date} / ${PRIZE_KEYS[slot]} = ${value}.`)
      }
      numbers[draw * SLOTS_PER_DRAW + slot] = value
    }
    dates.push(record.date)
  }

  return { dates, numbers, size: dates.length }
}

/** One draw with the full prize numbers (not only the last two digits). */
export interface FullDraw {
  date: string
  prizes: Record<PrizeKey, number>
}

export const LATEST_URL = 'data/xsmb-latest.json'

/** Formats a prize with its leading zeros, e.g. prize4 value 334 -> "0334". */
export function formatPrize(group: PrizeGroup, value: number): string {
  return String(value).padStart(group.digits, '0')
}

/**
 * Loads the latest draw with full numbers. Returns null when the file is missing or malformed,
 * since the dashboard can fall back to the two-digit data.
 */
export async function loadLatestDraw(): Promise<FullDraw | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${LATEST_URL}`, FETCH_OPTIONS)
    if (!res.ok) return null
    const raw = (await res.json()) as RawRecord
    const prizes = {} as Record<PrizeKey, number>
    for (const key of PRIZE_KEYS) {
      if (!Number.isInteger(raw[key])) return null
      prizes[key] = raw[key]
    }
    return { date: String(raw.date).slice(0, 10), prizes }
  } catch {
    return null
  }
}

export const SPECIALS_URL = 'data/xsmb-special.json'

/**
 * Aligns [date, special] pairs with the dataset: result[i] is the 5-digit special prize of
 * ds.dates[i], or −1 when missing or invalid.
 */
export function alignSpecials(ds: Dataset, raw: unknown): Int32Array {
  if (!Array.isArray(raw)) throw new Error('Dữ liệu giải ĐB không hợp lệ.')
  const byDate = new Map<string, number>()
  for (const entry of raw) {
    if (Array.isArray(entry) && typeof entry[0] === 'string' && Number.isInteger(entry[1]) && entry[1] >= 0 && entry[1] <= 99_999) {
      byDate.set(entry[0].slice(0, 10), entry[1])
    }
  }
  return Int32Array.from(ds.dates, (date) => byDate.get(date) ?? -1)
}

const specialsCache = new WeakMap<Dataset, Promise<Int32Array>>()

/** Loads the full special prizes on demand (only the special-prize tab needs them). */
export function loadSpecials(ds: Dataset): Promise<Int32Array> {
  let pending = specialsCache.get(ds)
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}${SPECIALS_URL}`, FETCH_OPTIONS)
      .then((res) => {
        if (!res.ok) throw new Error(`Không tải được dữ liệu giải ĐB (${res.status} ${res.statusText}).`)
        return res.json()
      })
      .then((raw) => alignSpecials(ds, raw))
      .catch((err: unknown) => {
        specialsCache.delete(ds)
        throw err
      })
    specialsCache.set(ds, pending)
  }
  return pending
}

let cache: Promise<Dataset> | null = null

/**
 * Fetches and parses the dataset. Subsequent calls return the same in-memory result;
 * a failed load is not cached, so calling again retries.
 */
export function loadDataset(): Promise<Dataset> {
  cache ??= fetch(`${import.meta.env.BASE_URL}${DATA_URL}`, FETCH_OPTIONS)
    .then((res) => {
      if (!res.ok) throw new Error(`Không tải được dữ liệu (${res.status} ${res.statusText}).`)
      return res.json()
    })
    .then(parseDataset)
    .catch((err: unknown) => {
      cache = null
      throw err
    })
  return cache
}
