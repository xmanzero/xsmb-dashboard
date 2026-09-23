import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { PATTERN_PRIORITY, SPECIAL_PATTERN_LABELS, type PatternStats } from '../../utils/advancedStats.ts'
import { formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import { Chart } from '../Chart.tsx'

const CATEGORY_COLORS: Record<string, string> = {
  ganh: '#f472b6',
  tien: '#34d399',
  kepBang: '#fbbf24',
  kepLech: '#fb923c',
  kepAm: '#a78bfa',
  thuong: '#334155',
}

/** Pie of the exclusive special-prize categories, with the expected share in the tooltip. */
export function PatternPie({ stats }: { stats: PatternStats }) {
  const option = useMemo<EChartsOption>(() => {
    const categories = [...PATTERN_PRIORITY, 'thuong' as const]
    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'item',
        formatter: (p: unknown) => {
          const { dataIndex } = p as { dataIndex: number }
          const key = categories[dataIndex]
          const count = stats.exclusive[key]
          return [
            `<b>${SPECIAL_PATTERN_LABELS[key]}</b>`,
            `Thực tế: <b>${formatInt(count)}</b> kỳ (${formatPercent(stats.total ? count / stats.total : 0, 2)})`,
            `Lý thuyết: ${formatPercent(stats.probabilities.exclusive[key], 2)}`,
          ].join('<br/>')
        },
      },
      legend: { bottom: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 10, itemHeight: 10 },
      series: [
        {
          type: 'pie',
          radius: ['34%', '60%'],
          center: ['50%', '44%'],
          itemStyle: { borderColor: CHART_COLORS.background, borderWidth: 2 },
          label: {
            color: CHART_COLORS.text,
            // Tiny slices (tiến, gánh) would overlap; their share is in the tooltip and the table.
            formatter: (p: unknown) => {
              const { percent } = p as { percent: number }
              return percent >= 2 ? `${formatDecimal(percent, 1)}%` : ''
            },
          },
          labelLine: { show: true },
          data: categories.map((key) => ({
            name: SPECIAL_PATTERN_LABELS[key],
            value: stats.exclusive[key],
            itemStyle: { color: CATEGORY_COLORS[key] },
          })),
        },
      ],
    }
  }, [stats])

  return <Chart option={option} height={340} />
}
