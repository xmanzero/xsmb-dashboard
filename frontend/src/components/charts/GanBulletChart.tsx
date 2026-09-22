import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDate, formatInt, formatPercent } from '../../utils/format.ts'
import { pad2, type GanStat } from '../../utils/lotteryStats.ts'
import { Chart, type ChartClickParams } from '../Chart.tsx'

interface GanBulletChartProps {
  items: GanStat[]
  alertRatio: number
  onSelect: (n: number) => void
}

function barColor(g: GanStat): string {
  if (g.alert) return '#ef4444'
  if (g.ratio >= 0.5) return '#f97316'
  return '#f59e0b'
}

/**
 * Bullet chart: the grey track is the record drought (kỷ lục gan), the coloured bar the current one,
 * and the white tick marks the alert threshold (alertRatio × record).
 */
export function GanBulletChart({ items, alertRatio, onSelect }: GanBulletChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const labels = items.map((g) => pad2(g.number))
    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: unknown) => {
          const g = items[(p as { dataIndex: number }[])[0].dataIndex]
          return [
            `<b style="font-size:15px">${pad2(g.number)}</b>${g.alert ? ' <span style="color:#fca5a5">· Cảnh báo</span>' : ''}`,
            `Đang gan: <b>${formatInt(g.current)}</b> kỳ (${formatPercent(g.ratio, 0)} kỷ lục)`,
            `Kỷ lục gan: <b>${formatInt(g.max)}</b> kỳ${g.maxEndDate ? `, kết thúc ${formatDate(g.maxEndDate)}` : ' (đang diễn ra)'}`,
            `Lần về cuối: ${g.lastSeen ? formatDate(g.lastSeen) : 'chưa từng về'}`,
          ].join('<br/>')
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: CHART_COLORS.text },
        itemWidth: 14,
        itemHeight: 8,
        data: ['Đang gan', 'Kỷ lục gan', `${Math.round(alertRatio * 100)}% kỷ lục`],
      },
      grid: { left: 8, right: 64, top: 32, bottom: 8, containLabel: true },
      xAxis: { ...AXIS_BASE, type: 'value', name: 'kỳ', axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted } },
      yAxis: {
        ...AXIS_BASE,
        type: 'category',
        inverse: true,
        data: labels,
        axisLabel: { ...AXIS_BASE.axisLabel, fontFamily: 'ui-monospace, monospace', fontWeight: 'bold', fontSize: 13 },
      },
      series: [
        {
          name: 'Kỷ lục gan',
          type: 'bar',
          data: items.map((g) => g.max),
          barWidth: 16,
          itemStyle: { color: 'rgba(148, 163, 184, 0.16)', borderRadius: 4 },
          label: {
            show: true,
            position: 'right',
            color: CHART_COLORS.muted,
            formatter: (p: unknown) => {
              const g = items[(p as { dataIndex: number }).dataIndex]
              return `${formatInt(g.current)}/${formatInt(g.max)}`
            },
          },
          z: 1,
        },
        {
          name: 'Đang gan',
          type: 'bar',
          data: items.map((g) => ({ value: g.current, itemStyle: { color: barColor(g) } })),
          barWidth: 16,
          // Overlap the record track exactly.
          barGap: '-100%',
          itemStyle: { color: '#f97316', borderRadius: 4 },
          z: 2,
        },
        {
          name: `${Math.round(alertRatio * 100)}% kỷ lục`,
          type: 'scatter',
          data: items.map((g, i) => [g.max * alertRatio, i]),
          symbol: 'rect',
          symbolSize: [2, 20],
          itemStyle: { color: '#f8fafc', opacity: 0.8 },
          silent: true,
          z: 3,
        },
      ],
    }
  }, [items, alertRatio])

  return (
    <Chart
      option={option}
      height={Math.max(200, items.length * 28 + 56)}
      onClick={(p: ChartClickParams) => onSelect(items[p.dataIndex]?.number ?? Number(p.name))}
    />
  )
}
