import { CalendarDays, MapPin, Moon } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { SLOTS_PER_DRAW } from '../../services/dataLoader.ts'
import {
  canChiYear,
  LUNAR_MARKER_LABELS,
  lunarDayFrequency,
  solarToLunar,
  STATION_BY_WEEKDAY,
  topByWeekday,
  WEEK_ORDER,
  WEEKDAY_LABELS,
  weekdayFrequency,
  type LunarMarker,
} from '../../utils/advancedStats.ts'
import { formatDate, formatDecimal, formatInt } from '../../utils/format.ts'
import {
  chiSquare,
  chiSquarePValue,
  NUMBER_COUNT,
  pad2,
  rankNumbers,
  scopeSlots,
  slotsPerDraw,
  type ChiSquareResult,
  type FrequencyResult,
} from '../../utils/lotteryStats.ts'
import { FrequencyHeatmap } from '../charts/FrequencyHeatmap.tsx'
import { RankBarChart } from '../charts/RankBarChart.tsx'
import { WeekdayHeatmap } from '../charts/WeekdayHeatmap.tsx'
import { ChiSquareNote } from '../ChiSquareNote.tsx'
import { EmptyState, Panel } from '../Panel.tsx'
import { Segmented, type SegmentOption } from '../Segmented.tsx'

const TOP_BY_STATION = 10
const LUNAR_BAR_COLORS: [string, string] = ['#0891b2', '#67e8f9']

const STATION_OPTIONS: readonly SegmentOption<string>[] = WEEK_ORDER.map((d) => ({
  value: String(d),
  label: `${WEEKDAY_LABELS[d]} · ${STATION_BY_WEEKDAY[d]}`,
}))

const LUNAR_OPTIONS: readonly SegmentOption<LunarMarker>[] = (Object.keys(LUNAR_MARKER_LABELS) as LunarMarker[]).map((m) => ({
  value: m,
  label: LUNAR_MARKER_LABELS[m],
}))

interface TabCalendarProps {
  analysis: Analysis
  onSelectNumber: (n: number) => void
}

export function TabCalendar({ analysis, onSelectNumber }: TabCalendarProps) {
  const { dataset, range, scope } = analysis
  const [station, setStation] = useState(() => String(WEEK_ORDER[0]))
  const [marker, setMarker] = useState<LunarMarker>('mung1')

  const weekday = useMemo(() => weekdayFrequency(dataset, range, scope), [dataset, range, scope])
  const stationTop = useMemo(() => topByWeekday(weekday, Number(station), TOP_BY_STATION), [weekday, station])

  // Is the distribution of numbers the same on every weekday? χ² test of independence on the 100 × 7 table.
  const weekdayTest = useMemo<ChiSquareResult>(() => {
    const totals = new Float64Array(NUMBER_COUNT)
    let draws = 0
    for (let d = 0; d < 7; d++) draws += weekday.drawsByDay[d]
    for (let i = 0; i < weekday.counts.length; i++) totals[Math.floor(i / 7)] += weekday.counts[i]
    const expected = Array.from(weekday.counts, (_, i) => (draws ? (totals[Math.floor(i / 7)] * weekday.drawsByDay[i % 7]) / draws : 0))
    const { statistic } = chiSquare(weekday.counts, expected)
    const degreesOfFreedom = (NUMBER_COUNT - 1) * (weekday.drawsByDay.filter((d) => d > 0).length - 1)
    return { statistic, degreesOfFreedom, pValue: chiSquarePValue(statistic, degreesOfFreedom) }
  }, [weekday])

  const lunar = useMemo(() => lunarDayFrequency(dataset, range, scope), [dataset, range, scope])
  const lunarView = useMemo(() => {
    const entry = lunar[marker]
    const total = entry.draws * slotsPerDraw(scope)
    const frequency: FrequencyResult = { counts: entry.counts, total, draws: entry.draws, expected: total / NUMBER_COUNT }
    const daysPresent = new Uint32Array(NUMBER_COUNT)
    const [start, end] = scopeSlots(scope)
    for (const t of entry.indexes) {
      const seen = new Set<number>()
      for (let slot = start; slot < end; slot++) seen.add(dataset.numbers[t * SLOTS_PER_DRAW + slot])
      for (const n of seen) daysPresent[n]++
    }
    return { frequency, daysPresent, top: rankNumbers(entry.counts, 10), test: chiSquare(entry.counts, Array(NUMBER_COUNT).fill(total / NUMBER_COUNT)) }
  }, [lunar, marker, scope, dataset])

  if (range.to <= range.from) return <EmptyState message="Không có kỳ quay nào trong khoảng thời gian đã chọn." />

  const lastDate = dataset.dates[range.to - 1]
  const lastLunar = solarToLunar(lastDate)
  const stationDay = Number(station)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-2"
          icon={CalendarDays}
          title="Bản đồ nhiệt theo thứ và đài"
          subtitle="Hàng là số 00–99, cột là thứ trong tuần kèm đài quay. Màu là tỷ lệ về trong ngày đó so với mức chung: đỏ là về nhiều hơn, xanh là ít hơn. Bấm vào ô để xem chi tiết số."
        >
          <WeekdayHeatmap frequency={weekday} onSelect={onSelectNumber} />
        </Panel>

        <Panel
          className="lg:col-span-3"
          icon={MapPin}
          title={`Top ${TOP_BY_STATION} số theo đài: ${STATION_BY_WEEKDAY[stationDay]} (${WEEKDAY_LABELS[stationDay]})`}
          subtitle={`${formatInt(weekday.drawsByDay[stationDay])} kỳ quay vào ${WEEKDAY_LABELS[stationDay]} trong khoảng đã lọc. Lưu ý: Hà Nội quay cả thứ 2 và thứ 5.`}
          footer={<ChiSquareNote test={weekdayTest} />}
        >
          <div className="px-2 pb-3">
            <Segmented label="Chọn đài" options={STATION_OPTIONS} value={station} onChange={setStation} />
          </div>
          <div className="overflow-x-auto px-2">
            <table className="w-full min-w-[420px] text-sm tabular-nums">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="w-10 py-2 font-medium">#</th>
                  <th className="py-2 font-medium">Số</th>
                  <th className="py-2 text-right font-medium">Số lượt về</th>
                  <th className="py-2 text-right font-medium">Lượt/kỳ</th>
                  <th className="py-2 text-right font-medium">So với mức chung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {stationTop.map((row, i) => (
                  <tr key={row.number}>
                    <td className="py-1.5 text-slate-500">{i + 1}</td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectNumber(row.number)}
                        className="rounded-md bg-slate-800 px-2 py-0.5 font-mono font-bold text-slate-100 transition hover:bg-violet-500/30 focus-visible:outline-2 focus-visible:outline-sky-400"
                      >
                        {pad2(row.number)}
                      </button>
                    </td>
                    <td className="py-1.5 text-right text-slate-200">{formatInt(row.count)}</td>
                    <td className="py-1.5 text-right text-slate-300">{formatDecimal(row.rate, 3)}</td>
                    <td className="py-1.5 text-right text-red-300">×{formatDecimal(row.rate / weekday.expectedRate, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        icon={Moon}
        title={`Ngày âm lịch đặc biệt: ${LUNAR_MARKER_LABELS[marker]}`}
        subtitle={`Kỳ cuối trong khoảng lọc (${formatDate(lastDate)}) là ngày ${lastLunar.day}/${lastLunar.month}${lastLunar.leap ? ' nhuận' : ''} năm ${canChiYear(lastLunar.year)}. Có ${formatInt(lunar[marker].draws)} kỳ quay rơi vào ${LUNAR_MARKER_LABELS[marker].toLowerCase()} âm lịch trong khoảng đã lọc.`}
        actions={<Segmented label="Ngày âm lịch" options={LUNAR_OPTIONS} value={marker} onChange={setMarker} />}
        footer={<ChiSquareNote test={lunarView.test} minExpected={lunarView.frequency.expected} />}
      >
        {lunar[marker].draws === 0 ? (
          <EmptyState message="Không có kỳ quay nào rơi vào ngày này trong khoảng thời gian đã chọn." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="flex flex-col lg:col-span-3">
              <FrequencyHeatmap frequency={lunarView.frequency} daysPresent={lunarView.daysPresent} onSelect={onSelectNumber} />
            </div>
            <div className="lg:col-span-2">
              <h3 className="px-2 text-xs font-semibold text-slate-300">Top 10 số về nhiều nhất vào {LUNAR_MARKER_LABELS[marker].toLowerCase()}</h3>
              <RankBarChart items={lunarView.top} colors={LUNAR_BAR_COLORS} expected={lunarView.frequency.expected} unit="lượt" onSelect={onSelectNumber} />
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
