import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDecimal, formatInt, formatSignedPercent } from '../../utils/format.ts'
import { pad2, type RankedNumber } from '../../utils/lotteryStats.ts'
import { Chart, type ChartClickParams } from '../Chart.tsx'

interface RankBarChartProps {
  items: RankedNumber[]
  /** [start, end] colours of the bar gradient. */
  colors: [string, string]
  /** Mean hits per number, drawn as a reference line. */
  expected: number
  unit: string
  onSelect: (n: number) => void
}

/** Horizontal bar chart of ranked numbers (rank 1 on top) with a dashed "trung bình" line. */
export function RankBarChart({ items, colors, expected, unit, onSelect }: RankBarChartProps) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: unknown) => {
          const [{ name, value }] = p as { name: string; value: number }[]
          const diff = expected > 0 ? value / expected - 1 : 0
          return `<b style="font-size:15px">${name}</b><br/>${formatInt(value)} ${unit} · ${formatSignedPercent(diff)} so với trung bình`
        },
      },
      grid: { left: 8, right: 56, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        ...AXIS_BASE,
        type: 'value',
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted },
      },
      yAxis: {
        ...AXIS_BASE,
        type: 'category',
        inverse: true,
        data: items.map((i) => pad2(i.number)),
        axisLabel: { ...AXIS_BASE.axisLabel, fontFamily: 'ui-monospace, monospace', fontWeight: 'bold', fontSize: 13 },
      },
      series: [
        {
          type: 'bar',
          data: items.map((i) => i.value),
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: colors[0] },
                { offset: 1, color: colors[1] },
              ],
            },
          },
          label: { show: true, position: 'right', color: CHART_COLORS.text, formatter: (p: unknown) => formatInt((p as { value: number }).value) },
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: CHART_COLORS.expected, type: 'dashed', opacity: 0.6 },
            label: { color: CHART_COLORS.text, formatter: `TB ${formatDecimal(expected, 1)}`, position: 'end' },
            data: [{ xAxis: expected }],
          },
        },
      ],
    }),
    [items, colors, expected, unit],
  )

  return <Chart option={option} height={Math.max(176, items.length * 30 + 40)} onClick={(p: ChartClickParams) => onSelect(Number(p.name))} />
}
