import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { STATION_BY_WEEKDAY, WEEK_ORDER, WEEKDAY_LABELS, type WeekdayFrequency } from '../../utils/advancedStats.ts'
import { formatDecimal, formatInt } from '../../utils/format.ts'
import { NUMBER_COUNT, pad2 } from '../../utils/lotteryStats.ts'
import { Chart, type ChartClickParams } from '../Chart.tsx'

interface WeekdayHeatmapProps {
  frequency: WeekdayFrequency
  onSelect: (n: number) => void
}

/**
 * 100 × 7 heatmap: rows are numbers 00–99, columns are weekdays / provinces. The colour is the rate on
 * that weekday relative to the fair-draw average (1 = average), so weekdays with fewer draws compare fairly.
 */
export function WeekdayHeatmap({ frequency, onSelect }: WeekdayHeatmapProps) {
  const option = useMemo<EChartsOption>(() => {
    const { counts, rates, drawsByDay, expectedRate } = frequency
    const data: [number, number, number][] = []
    let spread = 0
    for (let n = 0; n < NUMBER_COUNT; n++) {
      WEEK_ORDER.forEach((day, col) => {
        const ratio = expectedRate ? rates[n * 7 + day] / expectedRate : 0
        if (drawsByDay[day]) spread = Math.max(spread, Math.abs(ratio - 1))
        data.push([col, n, Number(ratio.toFixed(3))])
      })
    }
    spread = Math.max(0.05, spread)

    return {
      tooltip: {
        ...TOOLTIP_BASE,
        formatter: (p: unknown) => {
          const [col, n, ratio] = (p as { value: [number, number, number] }).value
          const day = WEEK_ORDER[col]
          return [
            `<b style="font-size:15px">${pad2(n)}</b> · ${WEEKDAY_LABELS[day]} (${STATION_BY_WEEKDAY[day]})`,
            `Về ${formatInt(counts[n * 7 + day])} lượt trong ${formatInt(drawsByDay[day])} kỳ`,
            `Trung bình ${formatDecimal(rates[n * 7 + day], 3)} lượt/kỳ · <b>×${formatDecimal(ratio, 2)}</b> so với mức chung`,
          ].join('<br/>')
        },
      },
      grid: { left: 36, right: 8, top: 48, bottom: 56 },
      xAxis: {
        ...AXIS_BASE,
        type: 'category',
        position: 'top',
        data: WEEK_ORDER.map((d) => `${WEEKDAY_LABELS[d]}\n${STATION_BY_WEEKDAY[d]}`),
        axisLabel: { ...AXIS_BASE.axisLabel, fontSize: 11, lineHeight: 14, interval: 0 },
        splitLine: { show: false },
        axisLine: { show: false },
      },
      yAxis: {
        ...AXIS_BASE,
        type: 'category',
        inverse: true,
        data: Array.from({ length: NUMBER_COUNT }, (_, n) => pad2(n)),
        axisLabel: { ...AXIS_BASE.axisLabel, fontFamily: 'ui-monospace, monospace', fontSize: 10, interval: 4 },
        splitLine: { show: false },
        axisLine: { show: false },
      },
      visualMap: {
        min: Number((1 - spread).toFixed(2)),
        max: Number((1 + spread).toFixed(2)),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemHeight: 200,
        itemWidth: 12,
        precision: 2,
        text: ['Nhiều hơn TB', 'Ít hơn TB'],
        inRange: { color: ['#2563eb', '#1e293b', '#ef4444'] },
        textStyle: { color: CHART_COLORS.text },
      },
      series: [
        {
          type: 'heatmap',
          data,
          itemStyle: { borderColor: CHART_COLORS.background, borderWidth: 1 },
          emphasis: { itemStyle: { borderColor: '#f8fafc', borderWidth: 1 } },
        },
      ],
    }
  }, [frequency])

  const handleClick = ({ value }: ChartClickParams) => onSelect((value as [number, number, number])[1])

  return <Chart option={option} height={NUMBER_COUNT * 10 + 104} onClick={handleClick} />
}
