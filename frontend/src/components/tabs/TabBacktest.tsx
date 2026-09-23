import { FlaskConical, LineChart, Scale, Settings2, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Analysis } from '../../hooks/useAnalysis.ts'
import { DEFAULT_ODDS, runBacktest, touchSet, type BacktestResult, type BettingOdds, type Strategy } from '../../utils/advancedStats.ts'
import { formatDate, formatInt, formatPercent } from '../../utils/format.ts'
import { EquityCurveChart } from '../charts/EquityCurveChart.tsx'
import { NumberField } from '../NumberField.tsx'
import { EmptyState, Panel } from '../Panel.tsx'
import { Segmented, type SegmentOption } from '../Segmented.tsx'
import { StatTile } from '../StatTile.tsx'

type StrategyKind = Strategy['kind']
type Progression = 'flat' | 'martingale'

const STRATEGY_OPTIONS: readonly SegmentOption<StrategyKind>[] = [
  { value: 'markov', label: '1. Bạc nhớ' },
  { value: 'ganChase', label: '2. Nuôi lô gan' },
  { value: 'deSet', label: '3. Dàn đề chạm' },
]

const STRATEGY_NAMES: Record<StrategyKind, string> = {
  markov: 'Bạc nhớ',
  ganChase: 'Nuôi lô gan',
  deSet: 'Dàn đề chạm',
}

const PROGRESSION_OPTIONS: readonly SegmentOption<Progression>[] = [
  { value: 'flat', label: 'Cược đều' },
  { value: 'martingale', label: 'Gấp thếp' },
]

const DIGITS = Array.from({ length: 10 }, (_, d) => d)

const SELECT =
  'rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 [color-scheme:dark] focus:border-sky-500 focus:outline-none'

export function TabBacktest({ analysis }: { analysis: Analysis }) {
  const { dataset, range } = analysis
  const [kind, setKind] = useState<StrategyKind>('markov')
  const [capital, setCapital] = useState(10_000_000)
  const [odds, setOdds] = useState<BettingOdds>(DEFAULT_ODDS)
  const [markovPoints, setMarkovPoints] = useState(10)
  const [ganThreshold, setGanThreshold] = useState(15)
  const [ganPoints, setGanPoints] = useState(10)
  const [progression, setProgression] = useState<Progression>('flat')
  const [multiplier, setMultiplier] = useState(1.5)
  const [maxSteps, setMaxSteps] = useState(20)
  const [touchDigits, setTouchDigits] = useState<[number, number]>([3, 8])
  const [dePerNumber, setDePerNumber] = useState(10_000)

  const deNumbers = useMemo(() => touchSet(touchDigits), [touchDigits])
  const strategies = useMemo<Record<StrategyKind, Strategy>>(
    () => ({
      markov: { kind: 'markov', points: markovPoints },
      ganChase: { kind: 'ganChase', threshold: ganThreshold, points: ganPoints, progression, multiplier, maxSteps },
      deSet: { kind: 'deSet', numbers: deNumbers, stakePerNumber: dePerNumber },
    }),
    [markovPoints, ganThreshold, ganPoints, progression, multiplier, maxSteps, deNumbers, dePerNumber],
  )
  // Each run is a single pass over the draws (a few ms), so all three are simulated for the comparison table.
  const results = useMemo<Record<StrategyKind, BacktestResult>>(
    () => ({
      markov: runBacktest(dataset, range, strategies.markov, capital, odds),
      ganChase: runBacktest(dataset, range, strategies.ganChase, capital, odds),
      deSet: runBacktest(dataset, range, strategies.deSet, capital, odds),
    }),
    [dataset, range, strategies, capital, odds],
  )

  if (range.to - range.from < 2) return <EmptyState message="Cần ít nhất 2 kỳ quay trong khoảng thời gian đã chọn." />

  const result = results[kind]
  const setOdd = (key: keyof BettingOdds) => (value: number) => setOdds((o) => ({ ...o, [key]: value }))

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
        <span>
          Đây là mô phỏng toán học trên dữ liệu quá khứ, không phải lời khuyên. Chơi lô đề là đánh bạc trái phép tại Việt Nam. Với tỷ lệ cược mặc định, mỗi
          100.000 đ đặt lô chỉ trả lại trung bình {formatInt(Math.round(results.markov.theoreticalReturn * 100_000))} đ, còn đề chỉ trả lại{' '}
          {formatInt(Math.round(results.deSet.theoreticalReturn * 100_000))} đ, nên mọi chiến thuật đều thua lỗ về dài hạn. Lãi hay lỗ trong một giai
          đoạn ngắn chỉ là may rủi.
        </span>
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel icon={Settings2} title="Cấu hình mô phỏng" subtitle={`Chạy qua ${formatInt(range.to - range.from)} kỳ của khoảng thời gian đang lọc ở thanh trên cùng.`}>
          <div className="flex flex-col gap-4 px-2 pb-2">
            <Segmented label="Chiến thuật" options={STRATEGY_OPTIONS} value={kind} onChange={setKind} />

            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Vốn ban đầu" value={capital} onChange={setCapital} min={1000} step={1_000_000} suffix="đ" />
              <NumberField label="Giá 1 điểm lô" value={odds.lotoCostPerPoint} onChange={setOdd('lotoCostPerPoint')} min={1} step={500} suffix="đ" />
              <NumberField label="Lô trúng 1 nháy / điểm" value={odds.lotoPayoutPerPoint} onChange={setOdd('lotoPayoutPerPoint')} min={0} step={1000} suffix="đ" />
              <NumberField label="Đề trả (lần tiền cược)" value={odds.dePayoutMultiplier} onChange={setOdd('dePayoutMultiplier')} min={0} step={1} suffix="×" />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              {kind === 'markov' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-slate-400">
                    Mỗi kỳ đánh lô con số hay về nhất vào ngày sau đề của kỳ trước. Bảng bạc nhớ chỉ học từ các kỳ trước ngày cược, không nhìn trước kết quả.
                  </p>
                  <NumberField label="Số điểm mỗi kỳ" value={markovPoints} onChange={setMarkovPoints} min={1} suffix="điểm" />
                </div>
              )}
              {kind === 'ganChase' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-slate-400">
                    Khi con lô gan nhất vượt ngưỡng, đánh con đó mỗi kỳ cho đến khi nó về hoặc hết số kỳ tối đa.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Bắt đầu nuôi khi gan >" value={ganThreshold} onChange={setGanThreshold} min={0} suffix="kỳ" />
                    <NumberField label="Số điểm khởi đầu" value={ganPoints} onChange={setGanPoints} min={1} suffix="điểm" />
                    <NumberField label="Nuôi tối đa" value={maxSteps} onChange={setMaxSteps} min={1} suffix="kỳ" />
                    {progression === 'martingale' && (
                      <NumberField label="Hệ số gấp thếp" value={multiplier} onChange={setMultiplier} min={1} max={5} step={0.1} suffix="×" />
                    )}
                  </div>
                  <Segmented label="Cách vào tiền" options={PROGRESSION_OPTIONS} value={progression} onChange={setProgression} />
                </div>
              )}
              {kind === 'deSet' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-slate-400">
                    Mỗi kỳ đánh đề tất cả các số chứa một trong hai chữ số chạm. Chạm 2 chữ số khác nhau cho dàn 36 số.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    {[0, 1].map((i) => (
                      <label key={i} className="flex flex-col gap-1 text-xs text-slate-400">
                        Chạm {i + 1}
                        <select
                          className={SELECT}
                          value={touchDigits[i]}
                          onChange={(e) => setTouchDigits((d) => (i === 0 ? [Number(e.target.value), d[1]] : [d[0], Number(e.target.value)]))}
                        >
                          {DIGITS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <span className="pb-2 text-xs text-slate-400">= dàn {deNumbers.length} số</span>
                  </div>
                  <NumberField label="Tiền cược mỗi số" value={dePerNumber} onChange={setDePerNumber} min={1} step={1000} suffix="đ" />
                </div>
              )}
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              label="Lợi nhuận ròng"
              value={`${result.netProfit >= 0 ? '+' : '−'}${formatInt(Math.abs(result.netProfit))} đ`}
              hint={`vốn cuối ${formatInt(result.finalBalance)} đ`}
              highlight={result.netProfit < 0}
            />
            <StatTile label="Tỷ lệ thắng" value={formatPercent(result.winRate, 1)} hint={`${formatInt(result.winDays)}/${formatInt(result.betDays)} kỳ có cược`} />
            <StatTile label="Sụt giảm lớn nhất" value={formatPercent(result.maxDrawdown, 1)} hint={`${formatInt(result.maxDrawdownAmount)} đ từ đỉnh`} />
            <StatTile
              label="Tỷ lệ hoàn tiền"
              value={formatPercent(result.returnToPlayer, 1)}
              hint={`lý thuyết ${formatPercent(result.theoreticalReturn, 1)} · cược ${formatInt(result.totalStaked)} đ`}
            />
          </div>
          {result.bankruptDate && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              Cháy tài khoản ngày {formatDate(result.bankruptDate)}: số dư không đủ cho lần cược tiếp theo, mô phỏng ngừng đặt cược từ đó.
            </p>
          )}
          <Panel
            icon={LineChart}
            title={`Đường cong vốn: ${STRATEGY_NAMES[kind]}`}
            subtitle="Đường xanh là số dư thực tế sau mỗi kỳ. Đường đỏ nét đứt là số dư kỳ vọng nếu mỗi đồng cược chỉ trả lại đúng tỷ lệ hoàn tiền lý thuyết."
          >
            {result.betDays === 0 ? (
              <EmptyState message="Chiến thuật không đặt cược kỳ nào trong khoảng thời gian này." />
            ) : (
              <EquityCurveChart result={result} />
            )}
          </Panel>
        </div>
      </div>

      <Panel
        icon={Scale}
        title="So sánh 3 chiến thuật"
        subtitle="Cùng vốn, cùng tỷ lệ cược và cùng khoảng thời gian. Bấm vào tên để xem đường cong vốn."
        footer={
          <span className="flex items-start gap-2">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
            Tỷ lệ hoàn tiền thực tế dao động quanh mức lý thuyết theo từng giai đoạn. Hãy thử chuyển khoảng thời gian sang "Toàn bộ" để thấy nó tiến về mức lý thuyết khi số kỳ tăng.
          </span>
        }
      >
        <div className="overflow-x-auto px-2">
          <table className="w-full min-w-[720px] text-sm tabular-nums">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-2 font-medium">Chiến thuật</th>
                <th className="py-2 text-right font-medium">Vốn cuối</th>
                <th className="py-2 text-right font-medium">Lợi nhuận</th>
                <th className="py-2 text-right font-medium">Kỳ cược</th>
                <th className="py-2 text-right font-medium">Thắng</th>
                <th className="py-2 text-right font-medium">Sụt giảm lớn nhất</th>
                <th className="py-2 text-right font-medium">Hoàn tiền thực tế</th>
                <th className="py-2 text-right font-medium">Lý thuyết</th>
                <th className="py-2 text-right font-medium">Cháy TK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(Object.keys(STRATEGY_NAMES) as StrategyKind[]).map((k) => {
                const r = results[k]
                return (
                  <tr key={k} className={k === kind ? 'bg-sky-500/5' : undefined}>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => setKind(k)}
                        className={`rounded-md px-2 py-0.5 font-medium transition focus-visible:outline-2 focus-visible:outline-sky-400 ${
                          k === kind ? 'bg-sky-500/15 text-sky-300' : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {STRATEGY_NAMES[k]}
                      </button>
                    </td>
                    <td className="py-1.5 text-right text-slate-200">{formatInt(r.finalBalance)}</td>
                    <td className={`py-1.5 text-right ${r.netProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {r.netProfit >= 0 ? '+' : '−'}
                      {formatInt(Math.abs(r.netProfit))}
                    </td>
                    <td className="py-1.5 text-right text-slate-300">{formatInt(r.betDays)}</td>
                    <td className="py-1.5 text-right text-slate-300">{formatPercent(r.winRate, 1)}</td>
                    <td className="py-1.5 text-right text-slate-300">{formatPercent(r.maxDrawdown, 1)}</td>
                    <td className="py-1.5 text-right text-slate-100">{formatPercent(r.returnToPlayer, 1)}</td>
                    <td className="py-1.5 text-right text-slate-400">{formatPercent(r.theoreticalReturn, 1)}</td>
                    <td className="py-1.5 text-right text-slate-400">{r.bankruptDate ? formatDate(r.bankruptDate) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
