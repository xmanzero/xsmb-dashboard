import { Link2, Network, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import {
  buildPairNetwork,
  computeCooccurrence,
  pad2,
  partnersOf,
  probabilityPerDraw,
  rankPairs,
  type PairRanking,
  type PairStat,
} from '../../utils/lotteryStats.ts'
import { PairNetworkChart } from '../charts/PairNetworkChart.tsx'
import { NumberSelect } from '../NumberSelect.tsx'
import { EmptyState, Panel } from '../Panel.tsx'
import { Segmented, type SegmentOption } from '../Segmented.tsx'

const TOP_PAIRS = 20
/** 100 × 99 / 2 unordered pairs. */
const PAIR_COUNT = 4950
const PARTNERS = 10

type EdgeLimit = '30' | '50' | '80'

const EDGE_OPTIONS: readonly SegmentOption<EdgeLimit>[] = [
  { value: '30', label: '30 cặp' },
  { value: '50', label: '50 cặp' },
  { value: '80', label: '80 cặp' },
]

const RANKING_OPTIONS: readonly SegmentOption<PairRanking>[] = [
  { value: 'count', label: 'Cùng về nhiều nhất', title: 'Xếp theo số kỳ cả hai số cùng về' },
  { value: 'lift', label: 'Vượt kỳ vọng nhất', title: 'Xếp theo lift: số kỳ cùng về chia cho mức kỳ vọng nếu hai số độc lập' },
]

interface PairsTabProps {
  analysis: Analysis
  onSelectNumber: (n: number) => void
}

export function PairsTab({ analysis, onSelectNumber }: PairsTabProps) {
  const { dataset, range, scope, frequency } = analysis
  const [edgeLimit, setEdgeLimit] = useState<EdgeLimit>('50')
  const [ranking, setRanking] = useState<PairRanking>('count')

  const matrix = useMemo(() => computeCooccurrence(dataset, range, scope), [dataset, range, scope])
  // With 'lift', require at least half the pair count expected under independence (~ draws × p²);
  // otherwise pairs seen once or twice top the ranking purely by chance.
  const minCount = ranking === 'lift' ? Math.max(2, Math.ceil(0.5 * frequency.draws * probabilityPerDraw(scope) ** 2)) : 1
  const network = useMemo(() => buildPairNetwork(matrix, Number(edgeLimit), ranking, minCount), [matrix, edgeLimit, ranking, minCount])
  const topPairs = useMemo(() => rankPairs(matrix, TOP_PAIRS, ranking, minCount), [matrix, ranking, minCount])

  const [focus, setFocus] = useState<number | null>(null)
  const focusNumber = focus ?? topPairs[0]?.a ?? 0
  const partners = useMemo(() => partnersOf(matrix, focusNumber, PARTNERS), [matrix, focusNumber])

  if (scope === 'special') {
    return <EmptyState message="Giải ĐB chỉ có 1 số mỗi kỳ nên không có cặp số. Hãy chọn phạm vi Lô tô (27 giải)." />
  }
  if (frequency.draws === 0 || network.edges.length === 0) {
    return <EmptyState message="Không đủ dữ liệu để tính cặp số trong khoảng thời gian đã chọn." />
  }

  const maxPartner = Math.max(1, ...partners.map((p) => p.count))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          icon={Network}
          title="Mạng liên kết cặp số"
          subtitle="Mỗi nút là một con lô, màu theo đầu. Hai nút được nối nếu thường về cùng một kỳ; đường càng dày thì số kỳ cùng về càng nhiều. Rê chuột để làm nổi các cặp, bấm vào nút để xem số hay về cùng số đó, kéo để di chuyển, cuộn để phóng to."
          actions={
            <div className="flex flex-wrap gap-2">
              <Segmented label="Xếp hạng cặp" options={RANKING_OPTIONS} value={ranking} onChange={setRanking} />
              <Segmented label="Số cặp hiển thị" options={EDGE_OPTIONS} value={edgeLimit} onChange={setEdgeLimit} />
            </div>
          }
        >
          <PairNetworkChart network={network} draws={frequency.draws} onSelect={setFocus} />
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={Users}
          title={`Số hay về cùng ${pad2(focusNumber)}`}
          subtitle={`${PARTNERS} số về cùng kỳ với ${pad2(focusNumber)} nhiều nhất trong khoảng đã lọc`}
          actions={<NumberSelect label="Chọn số" value={focusNumber} onChange={setFocus} />}
          footer="Lift = số kỳ cùng về ÷ số kỳ kỳ vọng nếu hai số độc lập. Lift ≈ 1 nghĩa là hai số không liên quan đến nhau."
        >
          <ul className="flex flex-col gap-1.5 px-2 py-1">
            {partners.map((p) => (
              <li key={p.b}>
                <button
                  type="button"
                  onClick={() => onSelectNumber(p.b)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  <span className="w-8 font-mono text-base font-bold text-slate-100">{pad2(p.b)}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-600 to-teal-300" style={{ width: `${(p.count / maxPartner) * 100}%` }} />
                  </span>
                  <span className="w-16 text-right text-sm text-slate-200 tabular-nums">{formatInt(p.count)} kỳ</span>
                  <LiftBadge lift={p.lift} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        icon={Link2}
        title={`Top ${TOP_PAIRS} cặp lô xiên 2`}
        footer={`Lưu ý: có ${formatInt(PAIR_COUNT)} cặp số, nên những cặp đứng đầu bảng gần như luôn vượt kỳ vọng (lift > 1) chỉ vì ngẫu nhiên, do chúng được chọn ra từ rất nhiều cặp. Chọn khoảng "Toàn bộ" sẽ thấy lift của các cặp dẫn đầu về sát 1. Cặp cùng về nhiều trong quá khứ không có khả năng về cùng nhau cao hơn ở kỳ sau.`}
        subtitle={
          ranking === 'count'
            ? 'Các cặp có số kỳ cùng về nhiều nhất. Bấm vào một số để xem chi tiết.'
            : `Các cặp vượt kỳ vọng nhiều nhất, chỉ tính cặp cùng về từ ${formatInt(minCount)} kỳ trở lên. Bấm vào một số để xem chi tiết.`
        }
      >
        <PairTable pairs={topPairs} onSelectNumber={onSelectNumber} />
      </Panel>
    </div>
  )
}

function PairTable({ pairs, onSelectNumber }: { pairs: PairStat[]; onSelectNumber: (n: number) => void }) {
  const numberButton = (n: number) => (
    <button
      type="button"
      onClick={() => onSelectNumber(n)}
      className="rounded-md bg-slate-800 px-2 py-0.5 font-mono font-bold text-slate-100 transition hover:bg-violet-500/30 focus-visible:outline-2 focus-visible:outline-sky-400"
    >
      {pad2(n)}
    </button>
  )

  return (
    <div className="overflow-x-auto px-2">
      <table className="w-full min-w-[560px] text-sm tabular-nums">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="w-10 py-2 font-medium">#</th>
            <th className="py-2 font-medium">Cặp</th>
            <th className="py-2 text-right font-medium">Cùng về</th>
            <th className="py-2 text-right font-medium">Tỷ lệ kỳ</th>
            <th className="py-2 text-right font-medium">Kỳ vọng nếu độc lập</th>
            <th className="py-2 text-right font-medium">Lift</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {pairs.map((p, i) => (
            <tr key={`${p.a}-${p.b}`}>
              <td className="py-1.5 text-slate-500">{i + 1}</td>
              <td className="py-1.5">
                <span className="flex items-center gap-1.5 text-slate-500">
                  {numberButton(p.a)}–{numberButton(p.b)}
                </span>
              </td>
              <td className="py-1.5 text-right font-semibold text-slate-100">{formatInt(p.count)} kỳ</td>
              <td className="py-1.5 text-right text-slate-300">{formatPercent(p.support, 1)}</td>
              <td className="py-1.5 text-right text-slate-400">{formatDecimal(p.expected, 1)}</td>
              <td className="py-1.5 text-right">
                <LiftBadge lift={p.lift} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LiftBadge({ lift }: { lift: number }) {
  const tone = lift >= 1.15 ? 'bg-emerald-500/15 text-emerald-300' : lift <= 0.87 ? 'bg-sky-500/15 text-sky-300' : 'bg-slate-800 text-slate-300'
  return <span className={`inline-block w-14 rounded px-1.5 py-0.5 text-center text-xs tabular-nums ${tone}`}>×{formatDecimal(lift, 2)}</span>
}
