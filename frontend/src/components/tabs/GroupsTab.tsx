import { Radar, Scale, Sigma, VolumeX } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import {
  autoBucket,
  chiSquare,
  digitAbsence,
  digitAbsenceProbability,
  digitDistribution,
  digitSumHistogram,
  parityTrend,
  type ChiSquareResult,
  type DigitAbsence,
  type PrizeScope,
  type TrendBucket,
} from '../../utils/lotteryStats.ts'
import { DigitRadar, type RadarMode } from '../charts/DigitRadar.tsx'
import { ParityTrendChart, type TrendMode } from '../charts/ParityTrendChart.tsx'
import { SumHistogramChart } from '../charts/SumHistogramChart.tsx'
import { EmptyState, Panel } from '../Panel.tsx'
import { Segmented, type SegmentOption } from '../Segmented.tsx'

type SumMode = 'sum' | 'mod10'

const RADAR_OPTIONS: readonly SegmentOption<RadarMode>[] = [
  { value: 'headTail', label: 'Đầu & Đuôi' },
  { value: 'touch', label: 'Chạm' },
]
const SUM_OPTIONS: readonly SegmentOption<SumMode>[] = [
  { value: 'sum', label: 'Tổng 0 – 18' },
  { value: 'mod10', label: 'Tổng lô đề (0 – 9)' },
]
const TREND_OPTIONS: readonly SegmentOption<TrendMode>[] = [
  { value: 'parity', label: 'Chẵn / Lẻ' },
  { value: 'size', label: 'Tài / Xỉu' },
]

const SUM_LABELS = Array.from({ length: 19 }, (_, s) => String(s))
const MOD10_LABELS = Array.from({ length: 10 }, (_, s) => String(s))

const BUCKET_LABELS: Record<TrendBucket, string> = { draw: 'từng kỳ', month: 'tháng', quarter: 'quý', year: 'năm' }

/** Buckets need enough numbers to give a meaningful share; the special prize has one number per draw. */
function chooseBucket(draws: number, scope: PrizeScope): TrendBucket {
  const bucket = autoBucket(draws)
  return scope === 'special' && bucket === 'draw' ? 'month' : bucket
}

interface GroupsTabProps {
  analysis: Analysis
}

export function GroupsTab({ analysis }: GroupsTabProps) {
  const { dataset, range, frequency, scope } = analysis
  const isLoto = scope === 'all'
  const [radarMode, setRadarMode] = useState<RadarMode>('headTail')
  const [sumMode, setSumMode] = useState<SumMode>('sum')
  const [trendMode, setTrendMode] = useState<TrendMode>('parity')

  const distribution = useMemo(() => digitDistribution(frequency), [frequency])
  const absence = useMemo(() => digitAbsence(dataset, range, scope), [dataset, range, scope])
  const sums = useMemo(() => digitSumHistogram(frequency), [frequency])
  const mod10 = useMemo(() => {
    const expected = Array<number>(10).fill(frequency.total / 10)
    return { expected, chiSquare: chiSquare(sums.observedMod10, expected) }
  }, [sums, frequency])
  const bucket = chooseBucket(frequency.draws, scope)
  const trend = useMemo(() => parityTrend(dataset, range, scope, bucket), [dataset, range, scope, bucket])
  const trendTotals = useMemo(
    () => trend.reduce((acc, p) => ({ even: acc.even + p.even, big: acc.big + p.big, total: acc.total + p.total }), { even: 0, big: 0, total: 0 }),
    [trend],
  )

  if (frequency.draws === 0) return <EmptyState message="Không có kỳ quay nào trong khoảng thời gian đã chọn." />

  const sumView =
    sumMode === 'sum'
      ? { labels: SUM_LABELS, observed: sums.observed, expected: sums.expected, test: sums.chiSquare }
      : { labels: MOD10_LABELS, observed: sums.observedMod10, expected: mod10.expected, test: mod10.chiSquare }
  const expectedAbsent = frequency.draws * digitAbsenceProbability(scope)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-2"
          icon={Radar}
          title={radarMode === 'touch' ? 'Radar Chạm' : 'Radar Đầu & Đuôi'}
          subtitle={
            radarMode === 'touch'
              ? 'Tỷ lệ số có chứa chữ số (chạm) 0–9. Đường nét đứt là mức 19% nếu kết quả ngẫu nhiên.'
              : 'Tỷ lệ số theo chữ số hàng chục (đầu) và hàng đơn vị (đuôi). Đường nét đứt là mức 10% nếu kết quả ngẫu nhiên.'
          }
          actions={<Segmented label="Kiểu radar" options={RADAR_OPTIONS} value={radarMode} onChange={setRadarMode} />}
        >
          <DigitRadar distribution={distribution} mode={radarMode} />
        </Panel>

        <Panel
          className="lg:col-span-3"
          icon={VolumeX}
          title="Đầu câm – Đuôi câm"
          subtitle={
            isLoto
              ? `Số kỳ không có đầu (hoặc đuôi) đó trong ${formatInt(frequency.draws)} kỳ. Nếu ngẫu nhiên, mỗi chữ số câm khoảng ${formatDecimal(expectedAbsent, 1)} kỳ (${formatPercent(digitAbsenceProbability(scope), 1)}).`
              : 'Giải ĐB chỉ có 1 số mỗi kỳ, nên mỗi kỳ luôn có 9 đầu và 9 đuôi câm. Bảng này chỉ có ý nghĩa với Lô tô.'
          }
        >
          <AbsenceTable heads={absence.heads} tails={absence.tails} />
        </Panel>
      </div>

      <Panel
        icon={Sigma}
        title="Phân bố Tổng hai số cuối"
        subtitle={
          sumMode === 'sum'
            ? 'Tổng = đầu + đuôi (ví dụ 68 → 14). Tổng 9 có nhiều cách tạo nhất (10 số), tổng 0 và 18 chỉ có 1 số, nên đường lý thuyết có dạng tam giác.'
            : 'Tổng theo cách tính lô đề: (đầu + đuôi) mod 10, ví dụ 68 → 4. Mỗi tổng gồm đúng 10 số nên lý thuyết là 10% mỗi tổng.'
        }
        actions={<Segmented label="Kiểu tổng" options={SUM_OPTIONS} value={sumMode} onChange={setSumMode} />}
        footer={<ChiSquareVerdict test={sumView.test} minExpected={Math.min(...sumView.expected)} />}
      >
        <SumHistogramChart labels={sumView.labels} observed={sumView.observed} expected={sumView.expected} />
      </Panel>

      <Panel
        icon={Scale}
        title={trendMode === 'parity' ? 'Xu hướng Chẵn / Lẻ' : 'Xu hướng Tài / Xỉu'}
        subtitle={`Tỷ lệ theo ${BUCKET_LABELS[bucket]}. Toàn khoảng: ${
          trendMode === 'parity'
            ? `chẵn ${formatPercent(trendTotals.even / trendTotals.total, 2)}, lẻ ${formatPercent(1 - trendTotals.even / trendTotals.total, 2)}`
            : `tài ${formatPercent(trendTotals.big / trendTotals.total, 2)}, xỉu ${formatPercent(1 - trendTotals.big / trendTotals.total, 2)}`
        }.`}
        actions={<Segmented label="Chỉ số" options={TREND_OPTIONS} value={trendMode} onChange={setTrendMode} />}
      >
        <ParityTrendChart points={trend} bucket={bucket} mode={trendMode} />
      </Panel>
    </div>
  )
}

function AbsenceTable({ heads, tails }: { heads: DigitAbsence[]; tails: DigitAbsence[] }) {
  const cell = (a: DigitAbsence) => (
    <>
      <td className="py-1.5 pr-3 text-right text-slate-300">{formatInt(a.absentDraws)}</td>
      <td className="py-1.5 pr-3 text-right">
        {a.currentStreak > 0 ? (
          <span className="rounded bg-red-500/15 px-1.5 text-red-300">câm {formatInt(a.currentStreak)} kỳ</span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="py-1.5 pr-3 text-right text-slate-400">{formatInt(a.maxStreak)}</td>
    </>
  )

  return (
    <div className="overflow-x-auto px-2">
      <table className="w-full min-w-[520px] text-sm tabular-nums">
        <thead className="text-xs text-slate-500">
          <tr>
            <th rowSpan={2} className="w-12 py-1 text-left font-medium">
              Số
            </th>
            <th colSpan={3} className="border-b border-slate-800 py-1 text-center font-medium text-sky-300">
              Đầu
            </th>
            <th colSpan={3} className="border-b border-slate-800 py-1 text-center font-medium text-pink-300">
              Đuôi
            </th>
          </tr>
          <tr className="text-right">
            <th className="py-1 pr-3 font-medium">Số kỳ câm</th>
            <th className="py-1 pr-3 font-medium">Hiện tại</th>
            <th className="py-1 pr-3 font-medium">Chuỗi dài nhất</th>
            <th className="py-1 pr-3 font-medium">Số kỳ câm</th>
            <th className="py-1 pr-3 font-medium">Hiện tại</th>
            <th className="py-1 pr-3 font-medium">Chuỗi dài nhất</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {heads.map((h, d) => (
            <tr key={d}>
              <th scope="row" className="py-1.5 text-left font-mono text-base font-bold text-slate-200">
                {d}
              </th>
              {cell(h)}
              {cell(tails[d])}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChiSquareVerdict({ test, minExpected }: { test: ChiSquareResult; minExpected: number }) {
  const stats = (
    <span className="tabular-nums">
      Kiểm định χ²: χ² = <b className="text-slate-200">{formatDecimal(test.statistic, 2)}</b>, bậc tự do {test.degreesOfFreedom}, p ={' '}
      <b className="text-slate-200">{test.pValue < 0.001 ? '< 0,001' : formatDecimal(test.pValue, 3)}</b>.
    </span>
  )
  if (minExpected < 5) {
    return <>{stats} Mẫu quá nhỏ (có tổng kỳ vọng dưới 5 lần) nên kết quả kiểm định không đáng tin cậy.</>
  }
  return test.pValue >= 0.05 ? (
    <>
      {stats} <span className="text-emerald-300">Độ lệch so với lý thuyết nằm trong mức dao động ngẫu nhiên thông thường.</span>
    </>
  ) : (
    <>
      {stats} <span className="text-amber-300">Độ lệch có ý nghĩa thống kê ở mức 5% (khoảng 1/20 phép thử ngẫu nhiên cũng cho kết quả như vậy).</span>
    </>
  )
}
