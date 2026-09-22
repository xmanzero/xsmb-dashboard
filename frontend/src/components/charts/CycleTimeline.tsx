import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDate, formatDecimal, formatInt } from '../../utils/format.ts'
import { pad2, type CycleStat } from '../../utils/lotteryStats.ts'
import { Chart } from '../Chart.tsx'

interface CycleTimelineProps {
  cycle: CycleStat
  /** Last date of the range, where the ongoing gan is drawn. */
  endDate: string
}

/** Points shown before the user zooms out; older points stay reachable through the slider. */
const VISIBLE_POINTS = 120

/** Timeline of appearances: x = date, y = nhịp since the previous appearance, size = hits that day. */
export function CycleTimeline({ cycle, endDate }: CycleTimelineProps) {
  const option = useMemo<EChartsOption>(() => {
    const points = cycle.points.filter((p) => p.gap !== null).map((p) => [p.date, p.gap!, p.hits])
    const zoomStart = points.length > VISIBLE_POINTS ? points[points.length - VISIBLE_POINTS][0] : undefined
    const markLines = [
      ...(cycle.meanGap === null
        ? []
        : [
            {
              yAxis: cycle.meanGap,
              name: 'TB',
              lineStyle: { color: CHART_COLORS.accent, type: 'solid' as const },
              label: { position: 'insideEndTop' as const },
            },
          ]),
      // Mean and theoretical values are usually close, so their labels sit on opposite sides of the lines.
      {
        yAxis: cycle.expectedGap,
        name: 'Lý thuyết',
        lineStyle: { color: CHART_COLORS.expected, type: 'dashed' as const, opacity: 0.6 },
        label: { position: 'insideEndBottom' as const },
      },
    ]

    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'item',
        formatter: (p: unknown) => {
          const { seriesName, value } = p as { seriesName: string; value: [string, number, number] }
          const [date, gap, hits] = value
          if (seriesName === 'Đang gan') return `<b>${formatDate(date)}</b><br/>Đang gan ${formatInt(gap)} kỳ (chưa về lại)`
          return `<b>${formatDate(date)}</b><br/>Về sau ${formatInt(gap)} kỳ${hits > 1 ? ` · <span style="color:#fdba74">${hits} nháy</span>` : ''}`
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: CHART_COLORS.text },
        itemWidth: 10,
        itemHeight: 10,
        data: ['Lần về', 'Về nhiều nháy', 'Đang gan'],
      },
      grid: { left: 8, right: 16, top: 36, bottom: points.length > VISIBLE_POINTS ? 56 : 12, containLabel: true },
      xAxis: { ...AXIS_BASE, type: 'time', axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted }, splitLine: { show: false } },
      yAxis: {
        ...AXIS_BASE,
        type: 'value',
        name: 'Nhịp (kỳ)',
        min: 0,
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted },
      },
      dataZoom:
        points.length > VISIBLE_POINTS
          ? [
              { type: 'inside', startValue: zoomStart, filterMode: 'none' },
              {
                type: 'slider',
                startValue: zoomStart,
                height: 20,
                bottom: 8,
                borderColor: CHART_COLORS.axis,
                textStyle: { color: CHART_COLORS.muted },
                fillerColor: 'rgba(167, 139, 250, 0.15)',
                dataBackground: { lineStyle: { color: CHART_COLORS.muted }, areaStyle: { color: 'rgba(100,116,139,.2)' } },
                filterMode: 'none',
              },
            ]
          : [],
      series: [
        {
          name: 'Lần về',
          type: 'scatter',
          data: points.filter((p) => p[2] === 1),
          symbolSize: 7,
          itemStyle: { color: CHART_COLORS.accent, opacity: 0.85 },
          markLine: {
            symbol: 'none',
            silent: true,
            label: {
              color: CHART_COLORS.text,
              formatter: (p: unknown) => {
                const { name, value } = p as { name: string; value: number }
                return `${name} ${formatDecimal(value, 1)}`
              },
            },
            data: markLines,
          },
        },
        {
          name: 'Về nhiều nháy',
          type: 'scatter',
          data: points.filter((p) => (p[2] as number) > 1),
          symbolSize: (v: unknown) => 7 + 4 * ((v as number[])[2] - 1),
          itemStyle: { color: '#fb923c' },
        },
        {
          name: 'Đang gan',
          type: 'scatter',
          data: [[endDate, cycle.currentGan, 0]],
          symbol: 'diamond',
          symbolSize: 13,
          itemStyle: { color: 'transparent', borderColor: '#f87171', borderWidth: 2 },
        },
      ],
    }
  }, [cycle, endDate])

  return (
    <div>
      <Chart option={option} height={320} />
      <p className="px-2 text-xs text-slate-500">
        Số {pad2(cycle.number)}: mỗi chấm là một lần về. Chấm càng cao thì khoảng chờ từ lần trước càng dài. Kéo hoặc cuộn chuột để xem thêm.
      </p>
    </div>
  )
}
