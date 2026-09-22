import { Activity, Hourglass, Siren } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { formatDate, formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import { computeCycle, gapDistribution, pad2, probabilityPerDraw, type GanStat } from '../../utils/lotteryStats.ts'
import { CycleTimeline } from '../charts/CycleTimeline.tsx'
import { GanBulletChart } from '../charts/GanBulletChart.tsx'
import { GapHistogram } from '../charts/GapHistogram.tsx'
import { NumberSelect } from '../NumberSelect.tsx'
import { EmptyState, Panel } from '../Panel.tsx'
import { Segmented, type SegmentOption } from '../Segmented.tsx'
import { StatTile } from '../StatTile.tsx'

/** Must match the default alertRatio of computeGanStats, which produced analysis.gan. */
const ALERT_RATIO = 0.8
const TOP_GAN = 20
const NEAR_ALERTS = 10

type SortMode = 'current' | 'ratio'

const SORT_OPTIONS: readonly SegmentOption<SortMode>[] = [
  { value: 'current', label: 'Gan lâu nhất' },
  { value: 'ratio', label: 'Sát kỷ lục nhất' },
]

const SORTERS: Record<SortMode, (a: GanStat, b: GanStat) => number> = {
  current: (a, b) => b.current - a.current || b.ratio - a.ratio || a.number - b.number,
  ratio: (a, b) => b.ratio - a.ratio || b.current - a.current || a.number - b.number,
}

interface StreaksTabProps {
  analysis: Analysis
  onSelectNumber: (n: number) => void
}

export function StreaksTab({ analysis, onSelectNumber }: StreaksTabProps) {
  const { dataset, index, range, gan, scope } = analysis
  const isLoto = scope === 'all'
  const [sortMode, setSortMode] = useState<SortMode>('current')
  // Start the nhịp rơi view on the number that has been missing the longest.
  const [cycleNumber, setCycleNumber] = useState(() => [...gan].sort(SORTERS.current)[0]?.number ?? 0)

  const topGan = useMemo(() => [...gan].sort(SORTERS[sortMode]).slice(0, TOP_GAN), [gan, sortMode])
  const alerts = useMemo(() => gan.filter((g) => g.alert).sort(SORTERS.ratio), [gan])
  const nearAlerts = useMemo(() => gan.filter((g) => !g.alert && g.current > 0).sort(SORTERS.ratio).slice(0, NEAR_ALERTS), [gan])

  const cycle = useMemo(() => computeCycle(dataset, index, cycleNumber, range), [dataset, index, cycleNumber, range])
  const bins = useMemo(
    () => gapDistribution(cycle.gaps, probabilityPerDraw(scope), isLoto ? 1 : 25, isLoto ? 16 : 12),
    [cycle, scope, isLoto],
  )

  if (range.to <= range.from) return <EmptyState message="Không có kỳ quay nào trong khoảng thời gian đã chọn." />

  const endDate = dataset.dates[range.to - 1]
  const subject = isLoto ? 'lô' : 'đề'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          icon={Hourglass}
          title={`Top ${TOP_GAN} ${subject} gan`}
          subtitle={`Tính đến ${formatDate(endDate)}. Thanh màu là số kỳ đang gan, nền xám là kỷ lục gan của số đó từ năm 2005, vạch trắng là ngưỡng ${formatPercent(ALERT_RATIO, 0)} kỷ lục.`}
          actions={<Segmented label="Sắp xếp" options={SORT_OPTIONS} value={sortMode} onChange={setSortMode} />}
        >
          <GanBulletChart items={topGan} alertRatio={ALERT_RATIO} onSelect={onSelectNumber} />
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={Siren}
          title={`Cảnh báo gan ≥ ${formatPercent(ALERT_RATIO, 0)} kỷ lục`}
          subtitle={`${alerts.length} số đang gan gần hoặc vượt kỷ lục của chính nó`}
          footer="Một số gan lâu không làm tăng khả năng nó về ở kỳ sau, vì mỗi kỳ quay độc lập với các kỳ trước. Cảnh báo chỉ cho biết chuỗi gan hiện tại hiếm gặp so với lịch sử của số đó."
        >
          {alerts.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-500">Hiện không có số nào đạt ngưỡng.</p>
          ) : (
            <GanChips items={alerts} tone="alert" onSelect={onSelectNumber} />
          )}
          {nearAlerts.length > 0 && (
            <>
              <h3 className="mt-4 px-2 text-xs font-semibold text-slate-400">Gần ngưỡng nhất</h3>
              <GanChips items={nearAlerts} tone="neutral" onSelect={onSelectNumber} />
            </>
          )}
        </Panel>
      </div>

      <Panel
        icon={Activity}
        title="Nhịp rơi"
        subtitle="Khoảng cách giữa các lần về (tính bằng kỳ) của một số trong khoảng thời gian đã lọc"
        actions={<NumberSelect label="Chọn số" value={cycleNumber} onChange={setCycleNumber} />}
      >
        <div className="grid grid-cols-2 gap-3 px-2 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Số kỳ có về" value={formatInt(cycle.points.length)} />
          <StatTile label="Nhịp trung bình" value={cycle.meanGap === null ? '—' : formatDecimal(cycle.meanGap, 2)} hint="kỳ" />
          <StatTile label="Nhịp trung vị" value={cycle.medianGap === null ? '—' : formatDecimal(cycle.medianGap, 1)} hint="kỳ" />
          <StatTile label="Nhịp dài nhất" value={cycle.maxGap === null ? '—' : formatInt(cycle.maxGap)} hint="kỳ" />
          <StatTile label="Lý thuyết ngẫu nhiên" value={formatDecimal(cycle.expectedGap, 2)} hint="kỳ, nếu các số đều như nhau" />
          <StatTile label="Đang gan" value={formatInt(cycle.currentGan)} hint="kỳ" highlight={gan[cycleNumber]?.alert} />
        </div>

        <div className="mt-2 grid gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3">
            {cycle.points.length === 0 ? (
              <EmptyState message={`Số ${pad2(cycleNumber)} chưa về trong khoảng thời gian này.`} />
            ) : (
              <CycleTimeline cycle={cycle} endDate={endDate} />
            )}
          </div>
          <div className="xl:col-span-2">
            <h3 className="px-2 text-xs font-semibold text-slate-300">Phân bố nhịp so với lý thuyết</h3>
            {cycle.gaps.length === 0 ? (
              <EmptyState message="Cần ít nhất 2 lần về để tính nhịp." />
            ) : (
              <GapHistogram bins={bins} />
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}

const CHIP_TONES = {
  alert: { button: 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20', number: 'text-red-300', meta: 'text-red-200/80' },
  neutral: { button: 'border-slate-700 bg-slate-950/50 hover:bg-slate-800', number: 'text-slate-200', meta: 'text-slate-400' },
}

function GanChips({ items, tone, onSelect }: { items: GanStat[]; tone: keyof typeof CHIP_TONES; onSelect: (n: number) => void }) {
  const styles = CHIP_TONES[tone]
  return (
    <ul className="flex flex-wrap gap-2 px-2 py-1">
      {items.map((g) => (
        <li key={g.number}>
          <button
            type="button"
            onClick={() => onSelect(g.number)}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-sky-400 ${styles.button}`}
          >
            <span className={`font-mono text-lg font-bold ${styles.number}`}>{pad2(g.number)}</span>
            <span className={`text-xs leading-tight tabular-nums ${styles.meta}`}>
              {formatInt(g.current)}/{formatInt(g.max)} kỳ
              <br />
              {g.current >= g.max ? 'kỷ lục mới' : formatPercent(g.ratio, 0)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
