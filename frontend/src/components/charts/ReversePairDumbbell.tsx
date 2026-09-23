import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import type { ReversePairStat } from '../../utils/advancedStats.ts'
import { formatDecimal, formatInt } from '../../utils/format.ts'
import { pad2 } from '../../utils/lotteryStats.ts'
import { Chart } from '../Chart.tsx'

const XY_COLOR = '#a78bfa'
const YX_COLOR = '#f472b6'

/**
 * Dumbbell chart of the 45 reversed pairs: one dot per direction (draws with XY, draws with YX) joined
 * by a line, so a long bar means the two directions came out a different number of times.
 */
export function ReversePairDumbbell({ pairs }: { pairs: ReversePairStat[] }) {
  const option = useMemo<EChartsOption>(() => {
    const xy = pairs.map((p) => p.both + p.onlyA)
    const yx = pairs.map((p) => p.both + p.onlyB)
    const low = pairs.map((_, i) => Math.min(xy[i], yx[i]))
    const floor = Math.max(0, Math.floor((Math.min(...low) * 0.95) / 10) * 10)

    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as { dataIndex: number }[])[0].dataIndex
          const p = pairs[i]
          return [
            `<b style="font-size:15px">${pad2(p.a)} ⇄ ${pad2(p.b)}</b>`,
            `<span style="color:${XY_COLOR}">●</span> ${pad2(p.a)} về: <b>${formatInt(xy[i])}</b> kỳ`,
            `<span style="color:${YX_COLOR}">●</span> ${pad2(p.b)} về: <b>${formatInt(yx[i])}</b> kỳ`,
            `Cả hai cùng về: <b>${formatInt(p.both)}</b> kỳ (nếu độc lập: ${formatDecimal(p.expectedBoth, 1)})`,
            `Chỉ ${pad2(p.a)}: ${formatInt(p.onlyA)} · chỉ ${pad2(p.b)}: ${formatInt(p.onlyB)}`,
          ].join('<br/>')
        },
      },
      legend: {
        top: 0,
        right: 0,
        data: ['Chiều XY', 'Chiều YX'],
        textStyle: { color: CHART_COLORS.text },
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: { left: 8, right: 24, top: 32, bottom: 8, containLabel: true },
      xAxis: {
        ...AXIS_BASE,
        type: 'value',
        min: floor,
        name: 'kỳ',
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted },
      },
      yAxis: {
        ...AXIS_BASE,
        type: 'category',
        inverse: true,
        data: pairs.map((p) => `${pad2(p.a)}–${pad2(p.b)}`),
        axisLabel: { ...AXIS_BASE.axisLabel, fontFamily: 'ui-monospace, monospace', fontSize: 11 },
      },
      series: [
        // Invisible base up to the lower dot + thin visible bar up to the higher one = the connecting line.
        // Bars start at 0; the axis minimum simply clips the invisible part.
        { type: 'bar', stack: 'gap', silent: true, data: low, itemStyle: { color: 'transparent' }, barWidth: 3 },
        {
          type: 'bar',
          stack: 'gap',
          silent: true,
          data: pairs.map((_, i) => Math.abs(xy[i] - yx[i])),
          itemStyle: { color: 'rgba(148, 163, 184, 0.55)' },
          barWidth: 3,
        },
        { name: 'Chiều XY', type: 'scatter', data: xy.map((v, i) => [v, i]), symbolSize: 10, itemStyle: { color: XY_COLOR }, z: 3 },
        { name: 'Chiều YX', type: 'scatter', data: yx.map((v, i) => [v, i]), symbolSize: 10, itemStyle: { color: YX_COLOR }, z: 3 },
      ],
    }
  }, [pairs])

  return <Chart option={option} height={pairs.length * 20 + 56} />
}
