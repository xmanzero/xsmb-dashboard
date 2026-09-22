import { Flame, Grid3x3, Snowflake } from 'lucide-react'
import { useMemo } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { formatDecimal, formatInt } from '../../utils/format.ts'
import { describe, rankNumbers } from '../../utils/lotteryStats.ts'
import { FrequencyHeatmap } from '../charts/FrequencyHeatmap.tsx'
import { RankBarChart } from '../charts/RankBarChart.tsx'
import { EmptyState, Panel } from '../Panel.tsx'

const HOT_COLORS: [string, string] = ['#f59e0b', '#dc2626']
const COLD_COLORS: [string, string] = ['#1d4ed8', '#38bdf8']

interface FrequencyTabProps {
  analysis: Analysis
  onSelectNumber: (n: number) => void
}

export function FrequencyTab({ analysis, onSelectNumber }: FrequencyTabProps) {
  const { frequency, daysPresent, scope } = analysis
  const hot = useMemo(() => rankNumbers(frequency.counts, 10, 'desc'), [frequency])
  const cold = useMemo(() => rankNumbers(frequency.counts, 10, 'asc'), [frequency])
  const stats = useMemo(() => describe(frequency.counts), [frequency])

  if (frequency.draws === 0) return <EmptyState message="Không có kỳ quay nào trong khoảng thời gian đã chọn." />

  const subject = scope === 'all' ? 'lô tô (27 giải/kỳ)' : 'giải đặc biệt'

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Panel
        className="lg:col-span-3"
        icon={Grid3x3}
        title="Bản đồ nhiệt 00 – 99"
        subtitle={`Số lượt về của từng số ${subject}. Hàng là đầu, cột là đuôi. Bấm vào một ô để xem lịch sử.`}
        footer={
          <span className="tabular-nums">
            Nhiều nhất <b className="text-slate-200">{formatInt(stats.max)}</b> · Ít nhất{' '}
            <b className="text-slate-200">{formatInt(stats.min)}</b> · Trung bình{' '}
            <b className="text-slate-200">{formatDecimal(stats.mean, 2)}</b> · Độ lệch chuẩn{' '}
            <b className="text-slate-200">{formatDecimal(stats.std, 2)}</b>
          </span>
        }
      >
        <FrequencyHeatmap frequency={frequency} daysPresent={daysPresent} onSelect={onSelectNumber} />
      </Panel>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel icon={Flame} title="Top 10 số nóng" subtitle="Về nhiều lượt nhất trong khoảng đã lọc">
          <RankBarChart items={hot} colors={HOT_COLORS} expected={frequency.expected} unit="lượt" onSelect={onSelectNumber} />
        </Panel>
        <Panel icon={Snowflake} title="Top 10 số lạnh" subtitle="Về ít lượt nhất trong khoảng đã lọc">
          <RankBarChart items={cold} colors={COLD_COLORS} expected={frequency.expected} unit="lượt" onSelect={onSelectNumber} />
        </Panel>
      </div>
    </div>
  )
}
