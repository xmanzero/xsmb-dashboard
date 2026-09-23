import { Boxes, ChartScatter, Info } from 'lucide-react'
import { useMemo } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { buildPresence, frequentTriplets, hottestNumbers, pca2d, randomTopComponentShare } from '../../utils/advancedStats.ts'
import { formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import { NUMBER_COUNT, pad2 } from '../../utils/lotteryStats.ts'
import { PcaScatter } from '../charts/PcaScatter.tsx'
import { EmptyState, Panel } from '../Panel.tsx'
import { StatTile } from '../StatTile.tsx'

const CANDIDATES = 25
const TOP_TRIPLETS = 15
/** C(25, 3). */
const TRIPLET_COUNT = 2300

interface TabClusteringProps {
  analysis: Analysis
  onSelectNumber: (n: number) => void
}

export function TabClustering({ analysis, onSelectNumber }: TabClusteringProps) {
  const { dataset, range, scope } = analysis
  const draws = range.to - range.from

  // Always the 27 lô prizes: with the special prize alone there is one number per draw, nothing to cluster.
  const presence = useMemo(() => buildPresence(dataset, range, 'all'), [dataset, range])
  const pca = useMemo(() => (draws >= 2 ? pca2d(presence) : null), [presence, draws])
  const candidates = useMemo(() => hottestNumbers(presence, CANDIDATES), [presence])
  const triplets = useMemo(() => frequentTriplets(presence, candidates, TOP_TRIPLETS), [presence, candidates])

  if (!pca) return <EmptyState message="Cần ít nhất 2 kỳ quay trong khoảng thời gian đã chọn." />

  const chance = randomTopComponentShare(NUMBER_COUNT, draws)
  const beatsChance = pca.explained[0] > chance

  return (
    <div className="flex flex-col gap-4">
      {scope === 'special' && (
        <p className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
          <Info className="size-4 shrink-0" aria-hidden />
          Tab này luôn dùng 27 giải lô tô: giải ĐB chỉ có 1 số mỗi kỳ nên không có cụm hay bộ xiên để phân tích.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          icon={ChartScatter}
          title="Phân cụm PCA 2D"
          subtitle="Mỗi chấm là một con lô. Hai số nằm gần nhau khi chúng hay về cùng ngày hoặc cùng vắng mặt. Màu theo đầu số, bấm vào chấm để xem chi tiết số."
        >
          <PcaScatter pca={pca} onSelect={onSelectNumber} />
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={Info}
          title="Đọc biểu đồ PCA thế nào?"
          footer="PCA được tính ngay trên trình duyệt: ma trận hiệp phương sai 100 × 100 giữa chuỗi số lần về hằng ngày của các số, rồi tìm 2 vector riêng lớn nhất bằng phương pháp lặp lũy thừa (power iteration) có khử bậc (deflation)."
        >
          <div className="grid grid-cols-2 gap-3 px-2">
            <StatTile label="PC1 giải thích" value={formatPercent(pca.explained[0], 2)} hint="tổng phương sai" />
            <StatTile label="PC2 giải thích" value={formatPercent(pca.explained[1], 2)} hint="tổng phương sai" />
            <StatTile
              label="Mức ngẫu nhiên"
              value={`≈ ${formatPercent(chance, 2)}`}
              hint={`thành phần lớn nhất khi ${formatInt(draws)} kỳ hoàn toàn ngẫu nhiên`}
            />
            <StatTile label="Số kỳ phân tích" value={formatInt(draws)} hint="27 giải lô tô mỗi kỳ" />
          </div>
          <div className="mt-4 space-y-2 px-2 text-sm text-slate-300">
            <p>
              Với 100 số độc lập, mỗi thành phần chỉ giải thích khoảng 1% phương sai. Do dao động của mẫu hữu hạn, thành phần lớn nhất vẫn đạt khoảng{' '}
              {formatPercent(chance, 2)} dù dữ liệu hoàn toàn ngẫu nhiên.
            </p>
            <p className={beatsChance ? 'text-amber-200' : 'text-emerald-200'}>
              {beatsChance
                ? `PC1 (${formatPercent(pca.explained[0], 2)}) nhỉnh hơn mức ngẫu nhiên. Mức chênh này nhỏ; cần kiểm tra xem nó có lặp lại ở các khoảng thời gian khác không trước khi coi là một cụm thật.`
                : `PC1 (${formatPercent(pca.explained[0], 2)}) không vượt mức ngẫu nhiên, nên các "cụm" nhìn thấy trên biểu đồ chỉ là nhiễu: không có nhóm số nào thực sự hay về cùng nhau.`}
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        icon={Boxes}
        title={`Top ${TOP_TRIPLETS} bộ xiên 3 về cùng nhau nhiều nhất`}
        subtitle={`Xét mọi bộ 3 trong ${CANDIDATES} số về nhiều kỳ nhất (${formatInt(TRIPLET_COUNT)} bộ) và đếm số kỳ cả 3 số cùng về. Bấm vào một số để xem chi tiết.`}
        footer={`Lưu ý: ${formatInt(TRIPLET_COUNT)} bộ được so sánh cùng lúc, nên các bộ đứng đầu gần như luôn vượt kỳ vọng (lift > 1) chỉ vì ngẫu nhiên. Bộ về cùng nhiều trong quá khứ không có khả năng về cùng nhau cao hơn ở kỳ sau.`}
      >
        <div className="overflow-x-auto px-2">
          <table className="w-full min-w-[560px] text-sm tabular-nums">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="w-10 py-2 font-medium">#</th>
                <th className="py-2 font-medium">Bộ xiên 3</th>
                <th className="py-2 text-right font-medium">Cùng về</th>
                <th className="py-2 text-right font-medium">Tỷ lệ kỳ</th>
                <th className="py-2 text-right font-medium">Kỳ vọng nếu độc lập</th>
                <th className="py-2 text-right font-medium">Lift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {triplets.map((t, i) => (
                <tr key={t.numbers.join('-')}>
                  <td className="py-1.5 text-slate-500">{i + 1}</td>
                  <td className="py-1.5">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      {t.numbers.map((n, k) => (
                        <span key={n} className="flex items-center gap-1.5">
                          {k > 0 && '–'}
                          <button
                            type="button"
                            onClick={() => onSelectNumber(n)}
                            className="rounded-md bg-slate-800 px-2 py-0.5 font-mono font-bold text-slate-100 transition hover:bg-violet-500/30 focus-visible:outline-2 focus-visible:outline-sky-400"
                          >
                            {pad2(n)}
                          </button>
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-semibold text-slate-100">{formatInt(t.count)} kỳ</td>
                  <td className="py-1.5 text-right text-slate-300">{formatPercent(t.support, 2)}</td>
                  <td className="py-1.5 text-right text-slate-400">{formatDecimal(t.expected, 1)}</td>
                  <td className="py-1.5 text-right text-slate-200">×{formatDecimal(t.lift, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
