import { useId, useState } from 'react'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  hint?: string
}

/**
 * Numeric input that lets the user type freely (including an empty field) and only reports values
 * within [min, max]. It resyncs when the value changes from outside.
 */
export function NumberField({ label, value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, suffix, hint }: NumberFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)
  // Value changed from outside (e.g. a reset): show it, unless the draft already means the same number.
  if (value !== lastValue) {
    setLastValue(value)
    if (Number(draft) !== value) setDraft(String(value))
  }
  const parsed = Number(draft)
  const valid = draft.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-slate-400">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          aria-invalid={!valid}
          onChange={(e) => {
            setDraft(e.target.value)
            const next = Number(e.target.value)
            if (e.target.value.trim() !== '' && Number.isFinite(next) && next >= min && next <= max) onChange(next)
          }}
          className={`w-full min-w-0 rounded-lg border bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums [color-scheme:dark] focus:outline-none ${
            valid ? 'border-slate-700 focus:border-sky-500' : 'border-red-500/70'
          }`}
        />
        {suffix && <span className="shrink-0 text-xs text-slate-500">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
