import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, HEAT_GRADIENT, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDecimal, formatInt, formatPercent, formatSignedPercent } from '../../utils/format.ts'
import { head, NUMBER_COUNT, pad2, tail, type FrequencyResult } from '../../utils/lotteryStats.ts'
import { Chart, type ChartClickParams } from '../Chart.tsx'

interface FrequencyHeatmapProps {
  frequency: FrequencyResult
  daysPresent: Uint32Array
  onSelect: (n: number) => void
}

const DIGITS = Array.from({ length: 10 }, (_, d) => String(d))

/** 10×10 matrix: rows = đầu (tens digit), columns = đuôi (units digit), colour = hits in range. */
export function FrequencyHeatmap({ frequency, daysPresent, onSelect }: FrequencyHeatmapProps) {
  const option = useMemo<EChartsOption>(() => {
    const { counts, total, expected, draws } = frequency
    const data: [number, number, number][] = []
    let min = Infinity
    let max = -Infinity
    for (let n = 0; n < NUMBER_COUNT; n++) {
      data.push([tail(n), head(n), counts[n]])
      min = Math.min(min, counts[n])
      max = Math.max(max, counts[n])
    }
    if (max === min) max = min + 1

    return {
      tooltip: {
        ...TOOLTIP_BASE,
        formatter: (p: unknown) => {
          const [t, h, count] = (p as { value: [number, number, number] }).value
          const n = h * 10 + t
          const share = total > 0 ? count / total : 0
          const diff = expected > 0 ? count / expected - 1 : 0
          return [
            `<div style="font-size:18px;font-weight:700;margin-bottom:4px">${pad2(n)}</div>`,
            `Số lần về: <b>${formatInt(count)}</b> lượt (${formatPercent(share)})`,
            `Mức trung bình: ${formatDecimal(expected, 1)} lượt · <b>${formatSignedPercent(diff)}</b>`,
            `Số kỳ có về: ${formatInt(daysPresent[n])}/${formatInt(draws)}`,
            `<span style="color:${CHART_COLORS.muted}">Bấm để xem lịch sử</span>`,
          ].join('<br/>')
        },
      },
      grid: { left: 44, right: 12, top: 36, bottom: 64 },
      xAxis: {
        ...AXIS_BASE,
        type: 'category',
        data: DIGITS,
        name: 'Đuôi',
        nameLocation: 'middle',
        nameGap: 24,
        position: 'top',
        splitLine: { show: false },
        axisLine: { show: false },
      },
      yAxis: {
        ...AXIS_BASE,
        type: 'category',
        data: DIGITS,
        name: 'Đầu',
        nameLocation: 'middle',
        nameGap: 28,
        inverse: true,
        splitLine: { show: false },
        axisLine: { show: false },
      },
      visualMap: {
        min,
        max,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemHeight: 220,
        itemWidth: 12,
        precision: 0,
        inRange: { color: HEAT_GRADIENT },
        textStyle: { color: CHART_COLORS.text },
        text: ['Nóng', 'Lạnh'],
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            formatter: (p: unknown) => {
              const [t, h, count] = (p as { value: [number, number, number] }).value
              return `{n|${pad2(h * 10 + t)}}\n{c|${formatInt(count)}}`
            },
            rich: {
              n: { fontSize: 13, fontWeight: 'bold', color: '#fff', lineHeight: 16 },
              c: { fontSize: 10, color: 'rgba(255,255,255,.85)', lineHeight: 13 },
            },
            textBorderColor: 'rgba(2,6,23,.55)',
            textBorderWidth: 2,
          },
          itemStyle: { borderColor: CHART_COLORS.background, borderWidth: 2, borderRadius: 6 },
          emphasis: { itemStyle: { borderColor: '#f8fafc', borderWidth: 2 } },
        },
      ],
    }
  }, [frequency, daysPresent])

  const handleClick = ({ value }: ChartClickParams) => {
    const [t, h] = value as [number, number, number]
    onSelect(h * 10 + t)
  }

  // Fills the panel height (so it lines up with the Top 10 column) but never gets shorter than 460px.
  return (
    <div className="min-h-[460px] flex-1">
      <Chart option={option} height="100%" onClick={handleClick} />
    </div>
  )
}
