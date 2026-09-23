import { BellRing, Hash, LoaderCircle, PieChart, RotateCw, Sigma } from 'lucide-react'
import { useMemo } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { useSpecials } from '../../hooks/useSpecials.ts'
import {
  baoKepDelay,
  cangDistribution,
  PATTERN_PRIORITY,
  SPECIAL_PATTERN_LABELS,
  specialPatterns,
  specialPatternStats,
  sum5Distribution,
} from '../../utils/advancedStats.ts'
import { formatDate, formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import { gapDistribution } from '../../utils/lotteryStats.ts'
import { ChiSquareNote } from '../ChiSquareNote.tsx'
import { GapHistogram } from '../charts/GapHistogram.tsx'
import { PatternPie } from '../charts/PatternPie.tsx'
import { SumHistogramChart } from '../charts/SumHistogramChart.tsx'
import { EmptyState, Panel } from '../Panel.tsx'
import { StatTile } from '../StatTile.tsx'

const DIGIT_LABELS = Array.from({ length: 10 }, (_, d) => String(d))
const SUM5_LABELS = Array.from({ length: 46 }, (_, s) => String(s))

export function TabSpecialDeep({ analysis }: { analysis: Analysis }) {
  const state = useSpecials(analysis.dataset)

  if (state.status === 'loading') {
    return (
      <p className="flex h-48 items-center justify-center gap-3 text-sm text-slate-400" role="status">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        Đang tải dữ liệu giải đặc biệt…
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-red-300" role="alert">
        {state.message}
        <button type="button" onClick={state.retry} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-slate-100 hover:bg-slate-700">
          <RotateCw className="size-4" aria-hidden />
          Thử lại
        </button>
      </div>
    )
  }
  return <SpecialDeepContent analysis={analysis} specials={state.specials} />
}

function SpecialDeepContent({ analysis, specials }: { analysis: Analysis; specials: Int32Array }) {
  const { dataset, range } = analysis

  const cang = useMemo(() => cangDistribution(specials, range), [specials, range])
  const sum5 = useMemo(() => sum5Distribution(specials, range), [specials, range])
  const patterns = useMemo(() => specialPatternStats(specials, range), [specials, range])
  const baoKep = useMemo(() => baoKepDelay(specials, range), [specials, range])
  // Under a fair draw the wait for a kép bằng is geometric with p = 0.1, signal or not.
  const baoKepBins = useMemo(() => gapDistribution(baoKep.delays, 0.1, 2, 12), [baoKep])
  const sum5Extra = useMemo(() => ({ name: 'Xấp xỉ Gauss', values: sum5.normal, color: '#38bdf8' }), [sum5])

  if (cang.total === 0) return <EmptyState message="Không có kỳ quay nào trong khoảng thời gian đã chọn." />

  const last = range.to - 1
  const lastSpecial = specials[last]
  const lastText = lastSpecial >= 0 ? String(lastSpecial).padStart(5, '0') : '—'
  const lastPatterns = lastSpecial >= 0 ? specialPatterns(lastSpecial) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={`Giải ĐB kỳ ${formatDate(dataset.dates[last])}`} value={lastText} hint={lastPatterns.length ? lastPatterns.map((p) => SPECIAL_PATTERN_LABELS[p]).join(', ') : 'Số thường'} />
        <StatTile label="Số kỳ phân tích" value={formatInt(cang.total)} hint="theo khoảng thời gian đã lọc" />
        <StatTile
          label="Tổng 5 chữ số trung bình"
          value={sum5.mean === null ? '—' : formatDecimal(sum5.mean, 2)}
          hint={`lý thuyết 22,5 · độ lệch chuẩn ${sum5.std === null ? '—' : formatDecimal(sum5.std, 2)} (lý thuyết 6,42)`}
        />
        <StatTile label="Tỷ lệ kép bằng" value={formatPercent(patterns.flags.kepBang / patterns.total, 1)} hint="lý thuyết 10%" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-2"
          icon={Hash}
          title="Phân tích 3 càng (chữ số hàng trăm)"
          subtitle="Tần suất của chữ số d₃ trong giải ĐB d₁d₂d₃d₄d₅. Nếu ngẫu nhiên, mỗi chữ số chiếm 10%."
          footer={<ChiSquareNote test={cang.chiSquare} minExpected={cang.total / 10} />}
        >
          <SumHistogramChart labels={DIGIT_LABELS} observed={cang.counts} expected={Array(10).fill(cang.total / 10)} binName="Càng" />
        </Panel>

        <Panel
          className="lg:col-span-3"
          icon={Sigma}
          title="Phân phối tổng 5 chữ số (0 – 45)"
          subtitle="Đường vàng là phân phối lý thuyết chính xác của tổng 5 chữ số ngẫu nhiên; đường xanh nét đứt là xấp xỉ Gauss N(22,5; 6,42²)."
          footer={<ChiSquareNote test={sum5.chiSquare} minExpected={sum5.total} />}
        >
          <SumHistogramChart labels={SUM5_LABELS} observed={sum5.observed} expected={sum5.expected} extra={sum5Extra} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          icon={PieChart}
          title="Dạng số đặc biệt"
          subtitle="Mỗi kỳ được xếp vào đúng một nhóm theo thứ tự ưu tiên: gánh → tiến → kép bằng → kép lệch → kép âm → thường. Bảng bên phải đếm riêng từng dạng (một số có thể thuộc nhiều dạng)."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <PatternPie stats={patterns} />
            <div className="overflow-x-auto px-2">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 font-medium">Dạng</th>
                    <th className="py-2 text-right font-medium">Số kỳ</th>
                    <th className="py-2 text-right font-medium">Thực tế</th>
                    <th className="py-2 text-right font-medium">Lý thuyết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {PATTERN_PRIORITY.map((key) => (
                    <tr key={key}>
                      <td className="py-1.5 text-slate-200">{SPECIAL_PATTERN_LABELS[key]}</td>
                      <td className="py-1.5 text-right text-slate-300">{formatInt(patterns.flags[key])}</td>
                      <td className="py-1.5 text-right text-slate-100">{formatPercent(patterns.flags[key] / patterns.total, 2)}</td>
                      <td className="py-1.5 text-right text-slate-400">{formatPercent(patterns.probabilities.flags[key], 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">
                Kép lệch: hai số cuối lệch nhau 5 (bóng dương, ví dụ 05, 16). Kép âm: cặp bóng âm (07, 14, 29, 36, 58). Gánh: d₁ = d₅ và d₂ = d₄. Tiến: d₁ &lt; d₂ &lt; d₃ &lt; d₄ &lt; d₅.
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={BellRing}
          title="Báo kép: d₁ = d₂ có báo trước kép bằng?"
          subtitle="Sau mỗi kỳ có hai chữ số đầu trùng nhau, đếm số kỳ phải chờ đến khi đề về kép bằng (d₄ = d₅)."
          footer={`Nếu các kỳ độc lập, thời gian chờ kép bằng trung bình là 10 kỳ, dù có "báo" hay không. So sánh cột "sau báo kép" với "từ kỳ bất kỳ": nếu hai con số gần nhau thì tín hiệu không có tác dụng.`}
        >
          <div className="grid grid-cols-3 gap-3 px-2">
            <StatTile label="Chờ sau báo kép" value={baoKep.mean === null ? '—' : `${formatDecimal(baoKep.mean, 2)} kỳ`} hint={`${formatInt(baoKep.delays.length)} lần báo`} />
            <StatTile label="Chờ từ kỳ bất kỳ" value={baoKep.baselineMean === null ? '—' : `${formatDecimal(baoKep.baselineMean, 2)} kỳ`} />
            <StatTile label="Lý thuyết" value={`${baoKep.theoreticalMean} kỳ`} />
          </div>
          {baoKep.delays.length === 0 ? (
            <EmptyState message="Không có lần báo kép nào trong khoảng thời gian này." />
          ) : (
            <>
              <h3 className="mt-3 px-2 text-xs font-semibold text-slate-300">Phân bố thời gian chờ sau báo kép</h3>
              <GapHistogram bins={baoKepBins} />
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
