import { ArrowRightLeft, CornerDownRight, Repeat, Waves } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { numberAt } from '../../services/dataLoader.ts'
import {
  buildPresence,
  markovTransitions,
  reversePairStats,
  specialToLotoCarry,
  streakStats,
  topNextNumbers,
  type ReversePairStat,
} from '../../utils/advancedStats.ts'
import { formatDate, formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import { pad2 } from '../../utils/lotteryStats.ts'
import { CarryDonut } from '../charts/CarryDonut.tsx'
import { NextNumberChart } from '../charts/NextNumberChart.tsx'
import { ReversePairDumbbell } from '../charts/ReversePairDumbbell.tsx'
import { StreakHistogram } from '../charts/StreakHistogram.tsx'
import { NumberSelect } from '../NumberSelect.tsx'
import { EmptyState, Panel } from '../Panel.tsx'
import { Segmented, type SegmentOption } from '../Segmented.tsx'
import { StatTile } from '../StatTile.tsx'

const TOP_NEXT = 10

type PairSort = 'gap' | 'number'

const PAIR_SORT_OPTIONS: readonly SegmentOption<PairSort>[] = [
  { value: 'gap', label: 'Chênh lệch lớn nhất' },
  { value: 'number', label: 'Theo thứ tự số' },
]

const PAIR_SORTERS: Record<PairSort, (x: ReversePairStat, y: ReversePairStat) => number> = {
  gap: (x, y) => Math.abs(y.onlyA - y.onlyB) - Math.abs(x.onlyA - x.onlyB) || x.a - y.a,
  number: (x, y) => x.a - y.a,
}

interface TabMarkovProps {
  analysis: Analysis
  onSelectNumber: (n: number) => void
}

export function TabMarkov({ analysis, onSelectNumber }: TabMarkovProps) {
  const { dataset, range, scope } = analysis
  const isLoto = scope === 'all'
  const hasDraws = range.to - range.from >= 2
  // Default "today" = the đề of the last draw in the range.
  const [source, setSource] = useState(() => (range.to > 0 ? numberAt(dataset, range.to - 1, 0) : 0))
  const [pairSort, setPairSort] = useState<PairSort>('gap')

  const presence = useMemo(() => buildPresence(dataset, range, scope), [dataset, range, scope])
  const transitions = useMemo(() => markovTransitions(presence), [presence])
  const next = useMemo(() => topNextNumbers(transitions, source, TOP_NEXT), [transitions, source])
  const carry = useMemo(() => specialToLotoCarry(dataset, range), [dataset, range])
  const pairs = useMemo(() => reversePairStats(presence).sort(PAIR_SORTERS[pairSort]), [presence, pairSort])
  const streaks = useMemo(() => streakStats(dataset, presence), [dataset, presence])

  if (!hasDraws) return <EmptyState message="Cần ít nhất 2 kỳ quay trong khoảng thời gian đã chọn." />

  const sourceDays = transitions.sourceDays[source]
  const meanLift = next.length ? next.reduce((s, x) => s + x.lift, 0) / next.length : 0
  const subject = isLoto ? 'lô' : 'đề'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          icon={CornerDownRight}
          title={`Bạc nhớ: hôm nay về ${pad2(source)}, hôm sau về gì?`}
          subtitle={`Trong các kỳ có ${subject} ${pad2(source)} (${formatInt(sourceDays)} kỳ), đây là ${TOP_NEXT} ${subject} hay về vào kỳ ngay sau nhất. Thanh tím là tỷ lệ về ngay sau ${pad2(source)}, vạch trắng là tỷ lệ về trong một kỳ bất kỳ của chính số đó.`}
          actions={<NumberSelect label="Số hôm nay" value={source} onChange={setSource} />}
          footer={
            sourceDays < 30
              ? `Chỉ có ${formatInt(sourceDays)} kỳ để thống kê, quá ít: các tỷ lệ trên dao động rất mạnh. Hãy chọn khoảng thời gian dài hơn.`
              : `Lift trung bình của ${TOP_NEXT} số đứng đầu là ${formatDecimal(meanLift, 2)}. Top 10 được chọn ra từ 100 số nên luôn nhỉnh hơn 1 một chút; nếu bạc nhớ có tác dụng thật, lift sẽ cao hơn hẳn 1 và ổn định khi đổi khoảng thời gian.`
          }
        >
          {sourceDays === 0 ? (
            <EmptyState message={`${pad2(source)} chưa về trong khoảng thời gian này.`} />
          ) : (
            <NextNumberChart source={source} items={next} onSelect={onSelectNumber} />
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={Repeat}
          title="Lô rơi từ đề"
          subtitle="Tỷ lệ kỳ mà số đề hôm nay về lại trong 27 giải lô của kỳ ngay sau."
          footer={`Nếu các kỳ độc lập, một số bất kỳ về trong 27 giải với xác suất 1 − 0,99²⁷ ≈ ${formatPercent(carry.expectedRate, 1)}, nên lô rơi từ đề khoảng 1/4 số kỳ là chuyện bình thường.`}
        >
          <CarryDonut carry={carry} />
          <div className="grid grid-cols-2 gap-3 px-2">
            <StatTile label="Số lần rơi" value={formatInt(carry.hits)} hint={`trên ${formatInt(carry.trials)} cặp kỳ liên tiếp`} />
            <StatTile label="Chênh so với lý thuyết" value={`${carry.rate >= carry.expectedRate ? '+' : '−'}${formatDecimal(Math.abs(carry.rate - carry.expectedRate) * 100, 1)} điểm %`} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          icon={ArrowRightLeft}
          title="Cặp số lộn (XY – YX)"
          subtitle="45 cặp số đảo ngược nhau, không tính số kép. Mỗi chấm là số kỳ một chiều có về; đường nối càng dài thì hai chiều càng chênh nhau."
          actions={<Segmented label="Sắp xếp" options={PAIR_SORT_OPTIONS} value={pairSort} onChange={setPairSort} />}
          footer="Rê chuột vào một cặp để xem số kỳ cả hai cùng về so với mức kỳ vọng nếu hai số độc lập."
        >
          <ReversePairDumbbell pairs={pairs} />
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={Waves}
          title="Chuỗi bệt"
          subtitle={`Số lần một ${subject} về liên tiếp k kỳ, so với lý thuyết nếu các kỳ độc lập. Trục dọc dùng thang log.`}
        >
          <StreakHistogram stats={streaks} />
          <div className="grid grid-cols-2 gap-3 px-2">
            <StatTile
              label="Kỷ lục bệt"
              value={streaks.record ? `${streaks.record.length} kỳ` : '—'}
              hint={streaks.record ? `Số ${pad2(streaks.record.number)}, kết thúc ${formatDate(streaks.record.endDate)}` : undefined}
            />
            <StatTile label="Tỷ lệ về mỗi kỳ" value={formatPercent(streaks.presenceRate, 1)} hint={`${formatInt(streaks.totalRuns)} chuỗi được đếm`} />
          </div>
          <h3 className="mt-4 px-2 text-xs font-semibold text-slate-400">Đang bệt (về 2+ kỳ liên tiếp đến kỳ cuối)</h3>
          {streaks.current.length === 0 ? (
            <p className="px-2 py-2 text-sm text-slate-500">Không có số nào.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 px-2 py-2">
              {streaks.current.map((s) => (
                <li key={s.number}>
                  <button
                    type="button"
                    onClick={() => onSelectNumber(s.number)}
                    className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 transition hover:bg-cyan-500/20 focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    <span className="font-mono text-base font-bold text-cyan-200">{pad2(s.number)}</span>
                    <span className="text-xs text-cyan-100/80">{s.length} kỳ</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
