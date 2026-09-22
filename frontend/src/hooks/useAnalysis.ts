import { useMemo } from 'react'

import type { Dataset } from '../services/dataLoader.ts'
import {
  buildOccurrenceIndex,
  computeGanStats,
  countDaysPresent,
  countFrequency,
  resolveRange,
  type DrawRange,
  type FrequencyResult,
  type GanStat,
  type OccurrenceIndex,
  type PrizeScope,
  type TimeFilter,
} from '../utils/lotteryStats.ts'

const indexCache = new WeakMap<Dataset, Partial<Record<PrizeScope, OccurrenceIndex>>>()

/** Occurrence index per dataset and scope, built at most once for the lifetime of the page. */
export function getOccurrenceIndex(ds: Dataset, scope: PrizeScope): OccurrenceIndex {
  let entry = indexCache.get(ds)
  if (!entry) {
    entry = {}
    indexCache.set(ds, entry)
  }
  return (entry[scope] ??= buildOccurrenceIndex(ds, scope))
}

export interface Analysis {
  dataset: Dataset
  scope: PrizeScope
  /** Draws selected by the time filter. */
  range: DrawRange
  /** All draws up to the end of the selected range; used for records such as kỷ lục gan. */
  historyRange: DrawRange
  index: OccurrenceIndex
  frequency: FrequencyResult
  daysPresent: Uint32Array
  /** Gan as of the last draw of the range, with records over the whole history up to that draw. */
  gan: GanStat[]
}

export function useAnalysis(dataset: Dataset, filter: TimeFilter, scope: PrizeScope): Analysis {
  const range = useMemo(() => resolveRange(dataset, filter), [dataset, filter])
  const index = useMemo(() => getOccurrenceIndex(dataset, scope), [dataset, scope])
  const frequency = useMemo(() => countFrequency(dataset, range, scope), [dataset, range, scope])
  const daysPresent = useMemo(() => countDaysPresent(index, range), [index, range])
  const historyRange = useMemo(() => ({ from: 0, to: range.to }), [range.to])
  const gan = useMemo(() => computeGanStats(dataset, index, historyRange), [dataset, index, historyRange])

  return useMemo(
    () => ({ dataset, scope, range, historyRange, index, frequency, daysPresent, gan }),
    [dataset, scope, range, historyRange, index, frequency, daysPresent, gan],
  )
}
