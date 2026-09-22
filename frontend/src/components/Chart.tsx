import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import { useEffect, useMemo, useRef } from 'react'

import { echarts, FONT_FAMILY, prefersReducedMotion } from '../lib/echarts.ts'

export interface ChartClickParams {
  name: string
  value: unknown
  dataIndex: number
  seriesIndex: number
  /** 'node' or 'edge' for graph series. */
  dataType?: string
  data?: unknown
}

interface ChartProps {
  /** Memoize this: a new object identity triggers a re-render of the chart. */
  option: EChartsOption
  height: number | string
  onClick?: (params: ChartClickParams) => void
  className?: string
}

const BASE_OPTION: EChartsOption = {
  backgroundColor: 'transparent',
  animation: !prefersReducedMotion,
  textStyle: { fontFamily: FONT_FAMILY },
  animationDuration: 400,
  animationDurationUpdate: 300,
}

/** Canvas ECharts wrapper: auto-resizes with its container and keeps click handlers fresh. */
export function Chart({ option, height, onClick, className }: ChartProps) {
  // echarts-for-react re-initialises the chart when `onEvents` changes, so pass a stable object
  // and read the latest handler through a ref.
  const clickRef = useRef(onClick)
  useEffect(() => {
    clickRef.current = onClick
  }, [onClick])
  const onEvents = useMemo(() => ({ click: (params: ChartClickParams) => clickRef.current?.(params) }), [])

  const merged = useMemo(() => ({ ...BASE_OPTION, ...option }), [option])

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={merged}
      notMerge
      lazyUpdate
      opts={{ renderer: 'canvas' }}
      onEvents={onEvents}
      className={className}
      style={{ height, width: '100%', cursor: onClick ? 'pointer' : undefined }}
    />
  )
}
