import { Segmented, type SegmentOption } from './Segmented.tsx'
import { TAB_GROUPS, TABS, type TabGroup, type TabId } from './tabConfig.ts'

const GROUP_OPTIONS: readonly SegmentOption<TabGroup>[] = TAB_GROUPS.map((g) => ({ value: g.id, label: g.label }))

/** Group switch ("Cơ bản" / "Chuyên sâu") followed by the tabs of the active group. */
export function TabNav({ value, onChange }: { value: TabId; onChange: (tab: TabId) => void }) {
  const group = TABS.find((t) => t.id === value)?.group ?? 'basic'
  const tabs = TABS.filter((t) => t.group === group)

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-slate-800">
      <div className="pb-2">
        <Segmented
          label="Nhóm phân tích"
          options={GROUP_OPTIONS}
          value={group}
          onChange={(next) => onChange(TABS.find((t) => t.group === next)!.id)}
        />
      </div>
      <nav role="tablist" aria-label="Phân tích" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => {
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
    </div>
  )
}
