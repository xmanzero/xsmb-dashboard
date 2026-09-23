import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'

import { AXIS_BASE, CHART_COLORS, TOOLTIP_BASE } from '../../lib/echarts.ts'
import type { BacktestResult } from '../../utils/advancedStats.ts'
import { formatDate, formatInt } from '../../utils/format.ts'
import { pad2 } from '../../utils/lotteryStats.ts'
import { Chart } from '../Chart.tsx'

/** Compact VNĐ for axis labels: 12.500.000 → "12,5tr", 1.200.000.000 → "1,2 tỷ". */
function compactVnd(value: number): string {
  const abs = Math.abs(value)
  const format = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
  if (abs >= 1e9) return `${format(value / 1e9)} tỷ`
  if (abs >= 1e6) return `${format(value / 1e6)}tr`
  if (abs >= 1e3) return `${format(value / 1e3)}k`
  return format(value)
}

/**
 * Balance after each draw, next to the balance the same stakes would leave on average
 * (capital − stakes × house edge), and the starting capital.
 */
export function EquityCurveChart({ result }: { result: BacktestResult }) {
  const option = useMemo<EChartsOption>(() => {
    const expected: [string, number][] = []
    for (let i = 0, staked = 0; i < result.days.length; i++) {
      staked += result.days[i].stake
      expected.push([result.days[i].date, Math.round(result.initialCapital - staked * (1 - result.theoreticalReturn))])
    }
    const actual = result.days.map((d) => [d.date, d.balance])
    const zoom = result.days.length > 400

    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: 'axis',
        formatter: (p: unknown) => {
          const i = (p as { dataIndex: number }[])[0].dataIndex
          const d = result.days[i]
          const bet = d.stake > 0 ? `Cược ${d.numbers.map(pad2).join(', ')}: ${formatInt(d.stake)} đ · thắng ${formatInt(d.payout)} đ` : 'Không cược'
          return [
            `<b>${formatDate(d.date)}</b>`,
            `Số dư: <b>${formatInt(d.balance)} đ</b>`,
            `Kỳ vọng theo lý thuyết: ${formatInt(expected[i][1])} đ`,
            bet,
          ].join('<br/>')
        },
      },
      legend: { top: 0, right: 0, textStyle: { color: CHART_COLORS.text }, itemWidth: 14, itemHeight: 8 },
      grid: { left: 8, right: 16, top: 36, bottom: zoom ? 56 : 8, containLabel: true },
      xAxis: { ...AXIS_BASE, type: 'time', axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted }, splitLine: { show: false } },
      yAxis: {
        ...AXIS_BASE,
        type: 'value',
        scale: true,
        axisLabel: { ...AXIS_BASE.axisLabel, color: CHART_COLORS.muted, formatter: compactVnd },
      },
      dataZoom: zoom
        ? [
            { type: 'inside' },
            { type: 'slider', height: 18, bottom: 6, borderColor: CHART_COLORS.axis, textStyle: { color: CHART_COLORS.muted }, fillerColor: 'rgba(56, 189, 248, 0.12)' },
          ]
        : [],
      series: [
        {
          name: 'Số dư thực tế',
          type: 'line',
          data: actual,
          symbol: 'none',
          lineStyle: { color: '#38bdf8', width: 2 },
          itemStyle: { color: '#38bdf8' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(56, 189, 248, 0.25)' },
                { offset: 1, color: 'rgba(56, 189, 248, 0)' },
              ],
            },
          },
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: CHART_COLORS.expected, type: 'dotted', opacity: 0.6 },
            label: { color: CHART_COLORS.text, formatter: 'Vốn ban đầu', position: 'insideStartTop' },
            data: [{ yAxis: result.initialCapital }],
          },
        },
        {
          name: 'Kỳ vọng theo tỷ lệ hoàn tiền',
          type: 'line',
          data: expected,
          symbol: 'none',
          lineStyle: { color: '#f87171', width: 1.5, type: 'dashed' },
          itemStyle: { color: '#f87171' },
        },
      ],
    }
  }, [result])

  return <Chart option={option} height={380} />
}
