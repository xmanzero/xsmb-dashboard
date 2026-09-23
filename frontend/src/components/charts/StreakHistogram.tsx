import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import type { StreakStats } from '../../utils/advancedStats.ts'
import { formatDecimal, formatInt } from '../../utils/format.ts'
import { Chart } from '../Chart.tsx'

/**
 * Histogram of bệt lengths on a log scale (counts fall roughly tenfold per extra day), against the
 * geometric distribution expected when each draw is independent.
 */
export function StreakHistogram({ stats }: { stats: StreakStats }) {
  const option = useMemo<EChartsOption>(() => {
    const lengths = stats.histogram.map((_, k) => k).slice(1)
    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        formatter: (p: unknown) => {
          const k = lengths[(p as { dataIndex: number }[])[0].dataIndex]
          return `Bệt <b>${k}</b> kỳ liên tiếp<br/>Thực tế: <b>${formatInt(stats.histogram[k])}</b> chuỗi<br/>Lý thuyết: ${formatDecimal(stats.expected[k], 1)} chuỗi`
        },
      },
      legend: { top: 0, right: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 14, itemHeight: 8 },
      grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
      xAxis: { ...AXIS_BASE, type: 'category', name: 'kỳ', data: lengths.map(String) },
      yAxis: {
        ...AXIS_BASE,
        type: 'log',
        min: 0.1,
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted },
      },
      series: [
        {
          name: 'Thực tế',
          type: 'bar',
          // A log axis cannot show 0; leave empty bins blank.
          data: lengths.map((k) => stats.histogram[k] || null),
          itemStyle: { color: '#22d3ee', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 36,
          label: { show: true, position: 'top', color: CHART_COLORS.text, formatter: (p: unknown) => formatInt((p as { value: number }).value) },
        },
        {
          name: 'Lý thuyết (hình học)',
          type: 'line',
          data: lengths.map((k) => Number(stats.expected[k].toFixed(3))),
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: CHART_COLORS.expected, type: 'dashed', width: 1.5 },
          itemStyle: { color: CHART_COLORS.expected },
        },
      ],
    }
  }, [stats])

  return <Chart option={option} height={280} />
}
