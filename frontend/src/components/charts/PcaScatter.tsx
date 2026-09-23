import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, HEAD_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import type { PcaResult } from '../../utils/advancedStats.ts'
import { formatDecimal, formatPercent } from '../../utils/format.ts'
import { head, pad2 } from '../../utils/lotteryStats.ts'
import { Chart, type ChartClickParams } from '../Chart.tsx'

/** The 100 numbers placed by their two main principal components, coloured by đầu. */
export function PcaScatter({ pca, onSelect }: { pca: PcaResult; onSelect: (n: number) => void }) {
  const option = useMemo<EChartsOption>(() => {
    const axis = (name: string, nameGap: number) => ({
      ...AXIS_BASE,
      type: 'value' as const,
      name,
      nameLocation: 'middle' as const,
      nameGap,
      scale: true,
      axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted, formatter: (v: number) => formatDecimal(v, 3) },
    })
    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'item',
        formatter: (p: unknown) => {
          const [x, y, n] = (p as { value: [number, number, number] }).value
          return `<b style="font-size:15px">${pad2(n)}</b><br/>PC1: ${formatDecimal(x, 4)}<br/>PC2: ${formatDecimal(y, 4)}`
        },
      },
      legend: {
        bottom: 0,
        data: HEAD_COLORS.map((_, h) => `Đầu ${h}`),
        textStyle: { color: CHART_COLORS.text },
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: { left: 36, right: 24, top: 16, bottom: 72, containLabel: true },
      xAxis: axis(`PC1 (${formatPercent(pca.explained[0], 2)} phương sai)`, 28),
      yAxis: axis(`PC2 (${formatPercent(pca.explained[1], 2)} phương sai)`, 52),
      series: HEAD_COLORS.map((color, h) => ({
        name: `Đầu ${h}`,
        type: 'scatter' as const,
        symbolSize: 22,
        itemStyle: { color, opacity: 0.85, borderColor: CHART_COLORS.background, borderWidth: 1 },
        label: {
          show: true,
          formatter: (p: unknown) => pad2((p as { value: [number, number, number] }).value[2]),
          color: '#020617',
          fontSize: 10,
          fontWeight: 'bold' as const,
          fontFamily: 'ui-monospace, monospace',
        },
        emphasis: { scale: 1.4 },
        data: pca.coords.filter((c) => head(c.number) === h).map((c) => [c.x, c.y, c.number]),
      })),
    }
  }, [pca])

  const handleClick = ({ value }: ChartClickParams) => onSelect((value as [number, number, number])[2])

  return <Chart option={option} height={560} onClick={handleClick} />
}
