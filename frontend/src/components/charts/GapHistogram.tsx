import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDecimal, formatInt } from '../../utils/format.ts'
import type { GapBin } from '../../utils/lotteryStats.ts'
import { Chart } from '../Chart.tsx'

function binLabel(b: GapBin): string {
  if (b.to === null) return `≥${b.from}`
  return b.from === b.to ? String(b.from) : `${b.from}–${b.to}`
}

/** Observed nhịp histogram against the geometric distribution expected from independent draws. */
export function GapHistogram({ bins }: { bins: GapBin[] }) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        formatter: (p: unknown) => {
          const b = bins[(p as { dataIndex: number }[])[0].dataIndex]
          return `Nhịp <b>${binLabel(b)}</b> kỳ<br/>Thực tế: <b>${formatInt(b.observed)}</b> lần<br/>Lý thuyết: ${formatDecimal(b.expected, 1)} lần`
        },
      },
      legend: { top: 0, right: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 14, itemHeight: 8 },
      grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
      xAxis: {
        ...AXIS_BASE,
        type: 'category',
        name: 'kỳ',
        data: bins.map(binLabel),
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted, interval: 0, fontSize: 11 },
      },
      yAxis: { ...AXIS_BASE, type: 'value', minInterval: 1, axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted } },
      series: [
        {
          name: 'Thực tế',
          type: 'bar',
          data: bins.map((b) => b.observed),
          itemStyle: { color: CHART_COLORS.accent, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 26,
        },
        {
          name: 'Phân phối hình học',
          type: 'line',
          data: bins.map((b) => Number(b.expected.toFixed(2))),
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: CHART_COLORS.expected, type: 'dashed', width: 1.5 },
          itemStyle: { color: CHART_COLORS.expected },
        },
      ],
    }),
    [bins],
  )

  return <Chart option={option} height={260} />
}
