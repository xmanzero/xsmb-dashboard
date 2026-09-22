import { ChevronLeft, ChevronRight } from 'lucide-react'

import { NUMBER_COUNT, pad2 } from '../utils/lotteryStats.ts'

const OPTIONS = Array.from({ length: NUMBER_COUNT }, (_, n) => n)

const STEP_BUTTON =
  'rounded-lg border border-slate-700 p-1.5 text-slate-300 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400'

/** 00–99 dropdown with previous / next buttons. */
export function NumberSelect({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const step = (delta: number) => onChange((value + delta + NUMBER_COUNT) % NUMBER_COUNT)
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={STEP_BUTTON} onClick={() => step(-1)} aria-label="Số trước">
        <ChevronLeft className="size-4" />
      </button>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-sm font-bold text-violet-300 [color-scheme:dark] focus:border-sky-500 focus:outline-none"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {pad2(n)}
          </option>
        ))}
      </select>
      <button type="button" className={STEP_BUTTON} onClick={() => step(1)} aria-label="Số sau">
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
