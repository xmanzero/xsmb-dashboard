import { CalendarRange, Crown, Layers } from 'lucide-react'

import type { Dataset } from '../services/dataLoader.ts'
import { formatDate, formatInt } from '../utils/format.ts'
import type { DrawRange, PrizeScope } from '../utils/lotteryStats.ts'
import { Segmented, type SegmentOption } from './Segmented.tsx'

export type PresetId = '30' | '100' | '1y' | 'all' | 'custom'

export interface DateSpan {
  start: string
  end: string
}

const PRESETS: readonly SegmentOption<PresetId>[] = [
  { value: '30', label: '30 kỳ' },
  { value: '100', label: '100 kỳ' },
  { value: '1y', label: '1 năm' },
  { value: 'all', label: 'Toàn bộ', title: 'Toàn bộ lịch sử từ 2005' },
  { value: 'custom', label: 'Tùy chọn', icon: CalendarRange },
]

const SCOPES: readonly SegmentOption<PrizeScope>[] = [
  { value: 'all', label: 'Lô tô · 27 giải', icon: Layers },
  { value: 'special', label: 'Đề · Giải ĐB', icon: Crown },
]

const DATE_INPUT =
  'rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 [color-scheme:dark] focus:border-sky-500 focus:outline-none'

interface FilterBarProps {
  dataset: Dataset
  preset: PresetId
  onPresetChange: (preset: PresetId) => void
  custom: DateSpan
  onCustomChange: (span: DateSpan) => void
  scope: PrizeScope
  onScopeChange: (scope: PrizeScope) => void
  range: DrawRange
}

export function FilterBar(props: FilterBarProps) {
  const { dataset, preset, onPresetChange, custom, onCustomChange, scope, onScopeChange, range } = props
  const min = dataset.dates[0]
  const max = dataset.dates[dataset.size - 1]
  const draws = range.to - range.from

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-slate-800/80 bg-slate-950/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Khoảng thời gian" options={PRESETS} value={preset} onChange={onPresetChange} />

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <label className="flex items-center gap-2">
              Từ
              <input
                type="date"
                className={DATE_INPUT}
                min={min}
                max={max}
                value={custom.start}
                onChange={(e) => e.target.value && onCustomChange({ ...custom, start: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2">
              đến
              <input
                type="date"
                className={DATE_INPUT}
                min={min}
                max={max}
                value={custom.end}
                onChange={(e) => e.target.value && onCustomChange({ ...custom, end: e.target.value })}
              />
            </label>
          </div>
        )}

        <Segmented label="Phạm vi giải" options={SCOPES} value={scope} onChange={onScopeChange} />

        <p className="ml-auto text-xs text-slate-500 tabular-nums" aria-live="polite">
          {draws > 0
            ? `${formatInt(draws)} kỳ · ${formatDate(dataset.dates[range.from])} – ${formatDate(dataset.dates[range.to - 1])}`
            : 'Không có kỳ quay nào trong khoảng này'}
        </p>
      </div>
    </div>
  )
}
