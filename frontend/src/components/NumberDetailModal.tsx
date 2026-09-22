import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import type { Analysis } from '../hooks/useAnalysis.ts'
import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../lib/echarts.ts'
import { SLOTS_PER_DRAW, SLOT_GROUPS } from '../services/dataLoader.ts'
import { formatDate, formatDecimal, formatInt, formatPercent } from '../utils/format.ts'
import { computeCycle, countMultiHits, pad2, probabilityPerDraw, scopeSlots } from '../utils/lotteryStats.ts'
import { Chart } from './Chart.tsx'
import { Modal } from './Modal.tsx'
import { StatTile } from './StatTile.tsx'

const RECENT_LIMIT = 12

interface NumberDetailModalProps {
  analysis: Analysis
  number: number
  onClose: () => void
}

export function NumberDetailModal({ analysis, number: n, onClose }: NumberDetailModalProps) {
  const { dataset, index, range, historyRange, frequency, daysPresent, gan, scope } = analysis
  const ganStat = gan[n]
  const isLoto = scope === 'all'

  const cycle = useMemo(() => computeCycle(dataset, index, n, historyRange), [dataset, index, n, historyRange])
  const multiHits = useMemo(() => (isLoto ? countMultiHits(index, range)[n] : 0), [isLoto, index, range, n])
  const rank = 1 + frequency.counts.filter((c) => c > frequency.counts[n]).length

  // Draws with the number per year vs. what a uniform random draw would give.
  const yearly = useMemo(() => {
    const years = new Map<string, { draws: number; hits: number }>()
    for (let d = historyRange.from; d < historyRange.to; d++) {
      const y = dataset.dates[d].slice(0, 4)
      const entry = years.get(y) ?? { draws: 0, hits: 0 }
      entry.draws++
      years.set(y, entry)
    }
    for (const p of cycle.points) years.get(p.date.slice(0, 4))!.hits++
    return [...years.entries()]
  }, [dataset, historyRange, cycle])

  const option = useMemo<EChartsOption>(() => {
    const p = probabilityPerDraw(scope)
    return {
      tooltip: { ...TOOLTIP_BASE, trigger: 'axis' },
      legend: { top: 0, right: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 14, itemHeight: 8 },
      grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
      xAxis: { ...AXIS_BASE, type: 'category', data: yearly.map(([y]) => y), axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted } },
      yAxis: { ...AXIS_BASE, type: 'value', minInterval: 1, axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted } },
      series: [
        {
          name: 'Số kỳ có về',
          type: 'bar',
          data: yearly.map(([, v]) => v.hits),
          itemStyle: { color: CHART_COLORS.accent, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 22,
        },
        {
          name: 'Kỳ vọng ngẫu nhiên',
          type: 'line',
          data: yearly.map(([, v]) => Number((v.draws * p).toFixed(1))),
          symbol: 'none',
          lineStyle: { color: CHART_COLORS.expected, type: 'dashed', width: 1.5, opacity: 0.7 },
          itemStyle: { color: CHART_COLORS.expected },
        },
      ],
    }
  }, [yearly, scope])

  const recent = useMemo(() => {
    const [start, end] = scopeSlots(scope)
    return cycle.points
      .slice(-RECENT_LIMIT)
      .reverse()
      .map((point) => {
        const prizes: string[] = []
        for (let slot = start; slot < end; slot++) {
          if (dataset.numbers[point.draw * SLOTS_PER_DRAW + slot] === n) prizes.push(SLOT_GROUPS[slot].short)
        }
        return { ...point, prizes }
      })
  }, [cycle, dataset, scope, n])

  const hits = frequency.counts[n]

  return (
    <Modal
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <span className="rounded-lg bg-violet-500/15 px-2.5 py-0.5 font-mono text-2xl text-violet-300">{pad2(n)}</span>
          {isLoto ? 'Chi tiết con lô' : 'Chi tiết con đề'}
        </span>
      }
      subtitle={
        frequency.draws > 0
          ? `Khoảng lọc: ${formatDate(dataset.dates[range.from])} – ${formatDate(dataset.dates[range.to - 1])} (${formatInt(frequency.draws)} kỳ)`
          : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Số lượt về" value={formatInt(hits)} hint={`Hạng ${rank}/100 · ${formatPercent(frequency.total ? hits / frequency.total : 0)}`} />
        <StatTile
          label="Số kỳ có về"
          value={formatInt(daysPresent[n])}
          hint={isLoto ? `Nháy (về ≥ 2 lần/kỳ): ${formatInt(multiHits)} kỳ` : `trên ${formatInt(frequency.draws)} kỳ`}
        />
        <StatTile
          label="Đang gan"
          value={`${formatInt(ganStat.current)} kỳ`}
          hint={ganStat.lastSeen ? `Lần cuối ${formatDate(ganStat.lastSeen)}` : 'Chưa từng về'}
          highlight={ganStat.alert}
        />
        <StatTile
          label="Kỷ lục gan"
          value={`${formatInt(ganStat.max)} kỳ`}
          hint={ganStat.maxEndDate ? `Kết thúc ${formatDate(ganStat.maxEndDate)}` : 'Đang diễn ra'}
        />
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Nhịp rơi trung bình (toàn lịch sử):{' '}
        <b className="text-slate-200">{cycle.meanGap === null ? '—' : `${formatDecimal(cycle.meanGap, 2)} kỳ`}</b>
        {' · '}lý thuyết ngẫu nhiên <b className="text-slate-200">{formatDecimal(cycle.expectedGap, 2)} kỳ</b>
        {cycle.maxGap !== null && (
          <>
            {' · '}nhịp dài nhất <b className="text-slate-200">{formatInt(cycle.maxGap)} kỳ</b>
          </>
        )}
      </p>

      <h3 className="mt-5 text-sm font-semibold text-slate-200">Số kỳ có về theo năm</h3>
      <Chart option={option} height={220} />

      <h3 className="mt-4 text-sm font-semibold text-slate-200">{RECENT_LIMIT} lần về gần nhất</h3>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Chưa về lần nào.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1.5 pr-4 font-medium">Ngày</th>
                <th className="py-1.5 pr-4 font-medium">Giải</th>
                <th className="py-1.5 pr-4 text-right font-medium">Nhịp từ lần trước</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recent.map((r) => (
                <tr key={r.draw}>
                  <td className="py-1.5 pr-4 text-slate-200">{formatDate(r.date)}</td>
                  <td className="py-1.5 pr-4 text-slate-300">
                    {r.prizes.join(', ')}
                    {r.hits > 1 && <span className="ml-2 rounded bg-orange-500/15 px-1.5 text-xs text-orange-300">{r.hits} nháy</span>}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-slate-400">{r.gap === null ? '—' : `${formatInt(r.gap)} kỳ`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
