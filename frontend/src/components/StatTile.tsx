interface StatTileProps {
  label: string
  value: string
  hint?: string
  /** Red emphasis, e.g. for a gan that passed the alert threshold. */
  highlight?: boolean
}

export function StatTile({ label, value, hint, highlight = false }: StatTileProps) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-red-500/40 bg-red-500/10' : 'border-slate-800 bg-slate-950/50'}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${highlight ? 'text-red-300' : 'text-slate-100'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
