/**
 * Tree-shaken ECharts setup shared by every chart, plus the dashboard's chart palette.
 * Registering only the charts we use keeps the bundle far smaller than `import * as echarts from 'echarts'`.
 */

import type { TooltipComponentOption } from 'echarts'
import { BarChart, GraphChart, HeatmapChart, LineChart, RadarChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  RadarChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export { echarts }

/** Honour the OS "reduce motion" setting: charts render their final state without animating. */
export const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const CHART_COLORS = {
  text: '#cbd5e1',
  muted: '#64748b',
  axis: '#334155',
  split: '#1e293b',
  background: '#020617',
  hot: '#f97316',
  cold: '#38bdf8',
  accent: '#a78bfa',
  expected: '#e2e8f0',
}

/** Cold → hot gradient: blue, cyan, yellow, orange, red. */
export const HEAT_GRADIENT = ['#1e3a8a', '#0ea5e9', '#facc15', '#f97316', '#dc2626']

export const FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export const TOOLTIP_BASE: TooltipComponentOption = {
  backgroundColor: 'rgba(15, 23, 42, 0.96)',
  borderColor: '#334155',
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: '#e2e8f0', fontSize: 12, fontFamily: FONT_FAMILY },
  extraCssText: 'border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.4);',
  confine: true,
}

export const AXIS_BASE = {
  axisLine: { lineStyle: { color: CHART_COLORS.axis } },
  axisTick: { show: false },
  axisLabel: { color: CHART_COLORS.text, fontFamily: FONT_FAMILY },
  splitLine: { lineStyle: { color: CHART_COLORS.split, type: 'dashed' as const } },
  nameTextStyle: { color: CHART_COLORS.muted, fontFamily: FONT_FAMILY },
}
