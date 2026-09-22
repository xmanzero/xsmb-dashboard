import type { LucideIcon } from 'lucide-react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  title?: string
}

interface SegmentedProps<T extends string> {
  label: string
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** Pill-style single-choice control (radio group semantics). */
export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
      {options.map(({ value: v, label: text, icon: Icon, title }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            title={title}
            onClick={() => onChange(v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-sky-400 ${
              active ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {text}
          </button>
        )
      })}
    </div>
  )
}
