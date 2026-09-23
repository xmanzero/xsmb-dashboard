import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDecimal, formatInt, formatSignedPercent } from '../../utils/format.ts'
import { Chart } from '../Chart.tsx'

interface SumHistogramChartProps {
  /** Label of each bin, e.g. "0".."18". */
  labels: string[]
  observed: ArrayLike<number>
  expected: readonly number[]
  /** Axis name and tooltip prefix of a bin. */
  binName?: string
  /** An optional extra reference curve, e.g. a normal approximation. */
  extra?: { name: string; values: readonly number[]; color: string }
}

/** Observed histogram (bars) against the theoretical distribution (line). */
export function SumHistogramChart({ labels, observed, expected, binName = 'Tổng', extra }: SumHistogramChartProps) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        formatter: (p: unknown) => {
          const i = (p as { dataIndex: number }[])[0].dataIndex
          const diff = expected[i] > 0 ? observed[i] / expected[i] - 1 : 0
          const extraLine = extra ? `<br/>${extra.name}: ${formatDecimal(extra.values[i], 1)}` : ''
          return `${binName} <b>${labels[i]}</b><br/>Thực tế: <b>${formatInt(observed[i])}</b><br/>Lý thuyết: ${formatDecimal(expected[i], 1)} (${formatSignedPercent(diff, 1)})${extraLine}`
        },
      },
      legend: { top: 0, right: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 14, itemHeight: 8 },
      grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
      xAxis: {
        ...AXIS_BASE,
        type: 'category',
        data: labels,
        name: binName,
        axisLabel: { ...AXIS_BASE.axisLabel, interval: labels.length > 24 ? 4 : 0 },
      },
      yAxis: { ...AXIS_BASE, type: 'value', axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted } },
      series: [
        {
          name: 'Thực tế',
          type: 'bar',
          data: Array.from(observed),
          barMaxWidth: 34,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#818cf8' },
                { offset: 1, color: '#4338ca' },
              ],
            },
          },
        },
        {
          name: 'Phân phối lý thuyết',
          type: 'line',
          data: expected.map((v) => Number(v.toFixed(2))),
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: '#fbbf24', width: 2 },
          itemStyle: { color: '#fbbf24' },
        },
        ...(extra
          ? [
              {
                name: extra.name,
                type: 'line' as const,
                data: extra.values.map((v) => Number(v.toFixed(2))),
                smooth: true,
                symbol: 'none',
                lineStyle: { color: extra.color, width: 1.5, type: 'dashed' as const },
                itemStyle: { color: extra.color },
              },
            ]
          : []),
      ],
    }),
    [labels, observed, expected, binName, extra],
  )

  return <Chart option={option} height={300} />
}
