import { TABS, type TabId } from './tabConfig.ts'

export function TabNav({ value, onChange }: { value: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav role="tablist" aria-label="Nhóm phân tích" className="flex gap-1 overflow-x-auto border-b border-slate-800">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${id}`}
            onClick={() => onChange(id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-sky-400 ${
              active ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
