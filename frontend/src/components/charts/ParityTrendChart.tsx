import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDate, formatInt, formatPercent } from '../../utils/format.ts'
import type { TrendBucket, TrendPoint } from '../../utils/lotteryStats.ts'
import { Chart } from '../Chart.tsx'

export type TrendMode = 'parity' | 'size'

const MODES: Record<TrendMode, { names: [string, string]; colors: [string, string]; pick: (p: TrendPoint) => [number, number] }> = {
  parity: { names: ['Chẵn', 'Lẻ'], colors: ['#22d3ee', '#a78bfa'], pick: (p) => [p.even, p.odd] },
  size: { names: ['Tài (50–99)', 'Xỉu (00–49)'], colors: ['#f97316', '#38bdf8'], pick: (p) => [p.big, p.small] },
}

function formatLabel(label: string, bucket: TrendBucket): string {
  if (bucket === 'draw') return formatDate(label)
  if (bucket === 'month') return `${label.slice(5, 7)}/${label.slice(0, 4)}`
  return label
}

interface ParityTrendChartProps {
  points: TrendPoint[]
  bucket: TrendBucket
  mode: TrendMode
}

/** 100% stacked area of Chẵn/Lẻ or Tài/Xỉu share per time bucket, with the 50% line. */
export function ParityTrendChart({ points, bucket, mode }: ParityTrendChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const { names, colors, pick } = MODES[mode]
    const share = (i: 0 | 1) => points.map((p) => (p.total > 0 ? Number(((pick(p)[i] / p.total) * 100).toFixed(2)) : 0))
    const zoom = points.length > 80

    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        formatter: (p: unknown) => {
          const i = (p as { dataIndex: number }[])[0].dataIndex
          const pt = points[i]
          const [a, b] = pick(pt)
          return [
            `<b>${formatLabel(pt.label, bucket)}</b> · ${formatInt(pt.total)} số`,
            `<span style="color:${colors[0]}">●</span> ${names[0]}: <b>${formatPercent(a / pt.total, 1)}</b> (${formatInt(a)})`,
            `<span style="color:${colors[1]}">●</span> ${names[1]}: <b>${formatPercent(b / pt.total, 1)}</b> (${formatInt(b)})`,
          ].join('<br/>')
        },
      },
      legend: { top: 0, right: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 14, itemHeight: 8 },
      grid: { left: 8, right: 16, top: 32, bottom: zoom ? 48 : 8, containLabel: true },
      xAxis: {
        ...AXIS_BASE,
        type: 'category',
        boundaryGap: false,
        data: points.map((p) => formatLabel(p.label, bucket)),
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted },
      },
      yAxis: {
        ...AXIS_BASE,
        type: 'value',
        min: 0,
        max: 100,
        interval: 25,
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted, formatter: '{value}%' },
      },
      dataZoom: zoom
        ? [
            { type: 'inside', startValue: points.length - 80 },
            {
              type: 'slider',
              startValue: points.length - 80,
              height: 18,
              bottom: 6,
              borderColor: CHART_COLORS.axis,
              textStyle: { color: CHART_COLORS.muted },
              fillerColor: 'rgba(56, 189, 248, 0.12)',
            },
          ]
        : [],
      series: names.map((name, i) => ({
        name,
        type: 'line' as const,
        stack: 'share',
        data: share(i as 0 | 1),
        symbol: 'none',
        smooth: 0.2,
        lineStyle: { width: 1, color: colors[i] },
        itemStyle: { color: colors[i] },
        areaStyle: { color: colors[i], opacity: 0.35 },
        ...(i === 0
          ? {
              markLine: {
                symbol: 'none',
                silent: true,
                lineStyle: { color: CHART_COLORS.expected, type: 'dashed' as const, opacity: 0.7 },
                label: { color: CHART_COLORS.text, formatter: '50%', position: 'insideEndTop' },
                data: [{ yAxis: 50 }],
              },
            }
          : {}),
      })),
    }
  }, [points, bucket, mode])

  return <Chart option={option} height={300} />
}
