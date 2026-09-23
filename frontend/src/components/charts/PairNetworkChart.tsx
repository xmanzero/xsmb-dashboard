import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { CHART_COLORS, HEAD_COLORS, prefersReducedMotion, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDecimal, formatInt, formatPercent } from '../../utils/format.ts'
import { head, pad2, type PairNetwork } from '../../utils/lotteryStats.ts'
import { Chart, type ChartClickParams } from '../Chart.tsx'

interface PairNetworkChartProps {
  network: PairNetwork
  draws: number
  onSelect: (n: number) => void
}

/**
 * Force-directed graph of the top pairs: nodes are numbers, an edge means the two numbers came out on
 * the same day, and thicker edges mean more such days.
 *
 * The option deliberately does not depend on the selected number: a new option restarts the force
 * layout and makes the nodes jump. Selection is ECharts' own `selectedMode` state instead.
 */
export function PairNetworkChart({ network, draws, onSelect }: PairNetworkChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const { nodes, edges } = network
    const maxDegree = Math.max(1, ...nodes.map((n) => n.degree))
    const counts = edges.map((e) => e.count)
    const minCount = Math.min(...counts)
    const spread = Math.max(1, Math.max(...counts) - minCount)

    return {
      tooltip: {
        ...TOOLTIP_BASE,
        formatter: (p: unknown) => {
          const { dataType, data } = p as { dataType: string; data: { pair?: (typeof edges)[number]; number?: number; degree?: number; days?: number } }
          if (dataType === 'edge' && data.pair) {
            const e = data.pair
            return [
              `<b style="font-size:15px">${pad2(e.a)} – ${pad2(e.b)}</b>`,
              `Cùng về: <b>${formatInt(e.count)}</b> kỳ (${formatPercent(e.support, 1)})`,
              `Nếu độc lập: ${formatDecimal(e.expected, 1)} kỳ · lift <b>${formatDecimal(e.lift, 2)}</b>`,
            ].join('<br/>')
          }
          return `<b style="font-size:15px">${pad2(data.number ?? 0)}</b><br/>Về ${formatInt(data.days ?? 0)}/${formatInt(draws)} kỳ<br/>Có mặt trong ${data.degree} cặp hàng đầu`
        },
      },
      legend: {
        bottom: 0,
        data: HEAD_COLORS.map((_, h) => `Đầu ${h}`),
        textStyle: { color: CHART_COLORS.text },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          categories: HEAD_COLORS.map((color, h) => ({ name: `Đầu ${h}`, itemStyle: { color } })),
          force: { repulsion: 150, gravity: 0.16, edgeLength: [50, 140], layoutAnimation: !prefersReducedMotion, friction: 0.15 },
          label: { show: true, position: 'inside', color: '#020617', fontWeight: 'bold', fontFamily: 'ui-monospace, monospace', fontSize: 11 },
          emphasis: { focus: 'adjacency', lineStyle: { width: 6, opacity: 1 } },
          selectedMode: 'single',
          select: { itemStyle: { borderColor: '#f8fafc', borderWidth: 3 } },
          lineStyle: { color: 'source', curveness: 0.12 },
          top: 16,
          bottom: 56,
          left: 16,
          right: 16,
          data: nodes.map((n) => ({
            id: String(n.number),
            name: pad2(n.number),
            number: n.number,
            degree: n.degree,
            days: n.daysPresent,
            category: head(n.number),
            symbolSize: 20 + 18 * (n.degree / maxDegree),
            itemStyle: { borderColor: 'rgba(2,6,23,.6)', borderWidth: 1 },
          })),
          links: edges.map((e) => ({
            source: String(e.a),
            target: String(e.b),
            pair: e,
            lineStyle: { width: 1 + 5 * ((e.count - minCount) / spread), opacity: 0.55 },
          })),
        },
      ],
    }
  }, [network, draws])

  const handleClick = ({ dataType, data }: ChartClickParams) => {
    const number = (data as { number?: number } | undefined)?.number
    if (dataType === 'node' && number !== undefined) onSelect(number)
  }

  return <Chart option={option} height={560} onClick={handleClick} />
}
