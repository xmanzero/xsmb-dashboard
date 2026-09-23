import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import type { NextNumber } from '../../utils/advancedStats.ts'
import { formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import { pad2 } from '../../utils/lotteryStats.ts'
import { Chart, type ChartClickParams } from '../Chart.tsx'

interface NextNumberChartProps {
  source: number
  items: NextNumber[]
  onSelect: (n: number) => void
}

/**
 * Horizontal bars: how often each number came out the day after `source` (conditional rate), with a
 * white tick at that number's usual rate on any day. A bar ending near its tick means no memory effect.
 */
export function NextNumberChart({ source, items, onSelect }: NextNumberChartProps) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: unknown) => {
          const x = items[(p as { dataIndex: number }[])[0].dataIndex]
          return [
            `<b style="font-size:15px">${pad2(source)} → ${pad2(x.number)}</b>`,
            `Về hôm sau: <b>${formatInt(x.count)}</b> lần (${formatPercent(x.conditionalRate, 1)} số kỳ có ${pad2(source)})`,
            `Tỷ lệ thường ngày của ${pad2(x.number)}: ${formatPercent(x.baselineRate, 1)}`,
            `Lift: <b>${formatDecimal(x.lift, 2)}</b> · P(j | i) = ${formatPercent(x.probability, 2)}`,
          ].join('<br/>')
        },
      },
      legend: { top: 0, right: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 14, itemHeight: 8 },
      grid: { left: 8, right: 56, top: 32, bottom: 8, containLabel: true },
      xAxis: {
        ...AXIS_BASE,
        type: 'value',
        max: (v: { max: number }) => Math.min(100, Math.ceil(v.max / 10) * 10 + 10),
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted, formatter: '{value}%' },
      },
      yAxis: {
        ...AXIS_BASE,
        type: 'category',
        inverse: true,
        data: items.map((x) => pad2(x.number)),
        axisLabel: { ...AXIS_BASE.axisLabel, fontFamily: 'ui-monospace, monospace', fontWeight: 'bold', fontSize: 13 },
      },
      series: [
        {
          name: 'Về hôm sau',
          type: 'bar',
          data: items.map((x) => Number((x.conditionalRate * 100).toFixed(2))),
          barWidth: 16,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#6d28d9' },
                { offset: 1, color: '#c084fc' },
              ],
            },
          },
          label: { show: true, position: 'right', color: CHART_COLORS.text, formatter: (p: unknown) => `${formatDecimal((p as { value: number }).value, 1)}%` },
        },
        {
          name: 'Tỷ lệ thường ngày',
          type: 'scatter',
          data: items.map((x, i) => [Number((x.baselineRate * 100).toFixed(2)), i]),
          symbol: 'rect',
          symbolSize: [3, 22],
          itemStyle: { color: '#f8fafc' },
          silent: true,
          z: 3,
        },
      ],
    }),
    [source, items],
  )

  return <Chart option={option} height={items.length * 32 + 56} onClick={(p: ChartClickParams) => onSelect(Number(p.name))} />
}
