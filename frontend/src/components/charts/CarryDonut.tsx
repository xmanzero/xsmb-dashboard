import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { CHART_COLORS, FONT_FAMILY, TOOLTIP_BASE } from '../../lib/echarts.ts'
import type { CarryStats } from '../../utils/advancedStats.ts'
import { formatInt, formatPercent } from '../../utils/format.ts'
import { Chart } from '../Chart.tsx'

const SLICES = [
  { name: 'Không rơi', color: '#334155' },
  { name: 'Rơi 1 lần', color: '#a78bfa' },
  { name: 'Rơi 2+ lần (nháy)', color: '#f472b6' },
]

/** Donut of what happened to each đề the next day, with the observed rate in the centre. */
export function CarryDonut({ carry }: { carry: CarryStats }) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'item',
        formatter: (p: unknown) => {
          const { name, value, percent } = p as { name: string; value: number; percent: number }
          return `${name}<br/><b>${formatInt(value)}</b> kỳ (${percent.toLocaleString('vi-VN')}%)`
        },
      },
      legend: { bottom: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 10, itemHeight: 10 },
      title: {
        text: formatPercent(carry.rate, 1),
        subtext: `lý thuyết ${formatPercent(carry.expectedRate, 1)}`,
        left: 'center',
        top: '36%',
        textStyle: { color: '#f8fafc', fontSize: 26, fontWeight: 'bold', fontFamily: FONT_FAMILY },
        subtextStyle: { color: CHART_COLORS.muted, fontSize: 12, fontFamily: FONT_FAMILY },
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '74%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: { borderColor: CHART_COLORS.background, borderWidth: 3 },
          data: carry.byHits.map((value, i) => ({ value, name: SLICES[i].name, itemStyle: { color: SLICES[i].color } })),
        },
      ],
    }),
    [carry],
  )

  return <Chart option={option} height={300} />
}
