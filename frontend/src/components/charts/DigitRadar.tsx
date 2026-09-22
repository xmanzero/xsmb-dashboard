import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import { formatDecimal, formatInt } from '../../utils/format.ts'
import type { DigitDistribution } from '../../utils/lotteryStats.ts'
import { Chart } from '../Chart.tsx'

export type RadarMode = 'headTail' | 'touch'

/** Share of numbers containing a given digit: 19 of 00–99 (10 as đầu + 10 as đuôi − the double). */
const TOUCH_PROBABILITY = 0.19

interface DigitRadarProps {
  distribution: DigitDistribution
  mode: RadarMode
}

/** Radar with one spoke per digit 0–9: share of numbers by đầu / đuôi, or by chạm, vs. uniform. */
export function DigitRadar({ distribution, mode }: DigitRadarProps) {
  const option = useMemo<EChartsOption>(() => {
    const { heads, tails, touches, total } = distribution
    const share = (arr: Uint32Array) => Array.from(arr, (c) => (total > 0 ? (c / total) * 100 : 0))
    const expected = (mode === 'touch' ? TOUCH_PROBABILITY : 0.1) * 100

    const series =
      mode === 'touch'
        ? [{ name: 'Chạm', values: share(touches), raw: touches, color: '#34d399' }]
        : [
            { name: 'Đầu', values: share(heads), raw: heads, color: '#38bdf8' },
            { name: 'Đuôi', values: share(tails), raw: tails, color: '#f472b6' },
          ]
    const max = Math.max(expected, ...series.flatMap((s) => s.values)) * 1.12

    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'item',
        formatter: (p: unknown) => {
          const { name } = p as { name: string }
          const s = series.find((x) => x.name === name)
          if (!s) return `Kỳ vọng nếu ngẫu nhiên: ${formatDecimal(expected, 1)}% cho mỗi chữ số`
          return [
            `<b>${name}</b>`,
            ...s.values.map((v, d) => `${d}: ${formatDecimal(v, 2)}% <span style="color:${CHART_COLORS.muted}">(${formatInt(s.raw[d])})</span>`),
          ].join('<br/>')
        },
      },
      legend: { bottom: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 14, itemHeight: 8 },
      radar: {
        indicator: Array.from({ length: 10 }, (_, d) => ({ name: String(d), max, min: 0 })),
        radius: '68%',
        center: ['50%', '48%'],
        splitNumber: 4,
        axisName: { color: CHART_COLORS.text, fontWeight: 'bold', fontSize: 14 },
        splitLine: { lineStyle: { color: CHART_COLORS.split } },
        splitArea: { areaStyle: { color: ['rgba(30,41,59,.25)', 'rgba(15,23,42,.25)'] } },
        axisLine: { lineStyle: { color: CHART_COLORS.axis } },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 5,
          data: [
            ...series.map((s) => ({
              name: s.name,
              value: s.values,
              lineStyle: { color: s.color, width: 2 },
              itemStyle: { color: s.color },
              areaStyle: { color: s.color, opacity: 0.12 },
            })),
            {
              name: 'Kỳ vọng',
              value: Array(10).fill(expected),
              symbol: 'none',
              lineStyle: { color: CHART_COLORS.expected, type: 'dashed', width: 1, opacity: 0.6 },
              itemStyle: { color: CHART_COLORS.expected },
            },
          ],
        },
      ],
    }
  }, [distribution, mode])

  return <Chart option={option} height={360} />
}
