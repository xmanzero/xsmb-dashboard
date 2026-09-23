import { RefreshCw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { useAnalysis } from '../hooks/useAnalysis.ts'
import { useNewDataCheck } from '../hooks/useNewDataCheck.ts'
import type { Dataset, FullDraw } from '../services/dataLoader.ts'
import { formatDate } from '../utils/format.ts'
import type { PrizeScope, TimeFilter } from '../utils/lotteryStats.ts'
import { FilterBar, type DateSpan, type PresetId } from './FilterBar.tsx'
import { Header } from './Header.tsx'
import { KpiCards } from './KpiCards.tsx'
import { LatestResultModal } from './LatestResultModal.tsx'
import { NumberDetailModal } from './NumberDetailModal.tsx'
import { TabNav } from './TabNav.tsx'
import { TABS, type TabId } from './tabConfig.ts'
import { FrequencyTab } from './tabs/FrequencyTab.tsx'
import { GroupsTab } from './tabs/GroupsTab.tsx'
import { PairsTab } from './tabs/PairsTab.tsx'
import { TabBacktest } from './tabs/TabBacktest.tsx'
import { TabCalendar } from './tabs/TabCalendar.tsx'
import { TabClustering } from './tabs/TabClustering.tsx'
import { TabMarkov } from './tabs/TabMarkov.tsx'
import { TabSpecialDeep } from './tabs/TabSpecialDeep.tsx'
import { StreaksTab } from './tabs/StreaksTab.tsx'

interface DashboardProps {
  dataset: Dataset
  latest: FullDraw | null
}

function toFilter(preset: PresetId, custom: DateSpan): TimeFilter {
  switch (preset) {
    case '30':
      return { kind: 'lastDraws', count: 30 }
    case '100':
      return { kind: 'lastDraws', count: 100 }
    case '1y':
      return { kind: 'lastYears', years: 1 }
    case 'all':
      return { kind: 'all' }
    case 'custom':
      return { kind: 'custom', start: custom.start, end: custom.end }
  }
}

function tabFromHash(): TabId {
  const id = window.location.hash.slice(1)
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'frequency'
}

export function Dashboard({ dataset, latest }: DashboardProps) {
  const [preset, setPreset] = useState<PresetId>('1y')
  const [custom, setCustom] = useState<DateSpan>(() => ({ start: dataset.dates[0], end: dataset.dates[dataset.size - 1] }))
  const [scope, setScope] = useState<PrizeScope>('all')
  const [tab, setTabState] = useState<TabId>(tabFromHash)
  const [selected, setSelected] = useState<number | null>(null)
  const [showLatest, setShowLatest] = useState(false)

  const filter = useMemo(() => toFilter(preset, custom), [preset, custom])
  const analysis = useAnalysis(dataset, filter, scope)
  const newDataDate = useNewDataCheck(dataset.dates[dataset.size - 1])

  const handlePresetChange = (next: PresetId) => {
    // Start the custom range from whatever is currently shown, so switching is seamless.
    if (next === 'custom' && preset !== 'custom' && analysis.range.to > analysis.range.from) {
      setCustom({ start: dataset.dates[analysis.range.from], end: dataset.dates[analysis.range.to - 1] })
    }
    setPreset(next)
  }

  // Mirror the active tab in the URL hash so a view can be bookmarked or shared (e.g. #streaks).
  const setTab = useCallback((next: TabId) => {
    setTabState(next)
    history.replaceState(null, '', `#${next}`)
  }, [])

  const closeNumber = useCallback(() => setSelected(null), [])
  const closeLatest = useCallback(() => setShowLatest(false), [])
  const openLatest = useCallback(() => setShowLatest(true), [])

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-6 sm:px-6">
      <Header dataset={dataset} />

      {newDataDate && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <span>Đã có kết quả mới ngày {formatDate(newDataDate)}.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-1.5 font-medium text-slate-950 transition hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-sky-200"
          >
            <RefreshCw className="size-4" aria-hidden />
            Tải lại
          </button>
        </div>
      )}

      <FilterBar
        dataset={dataset}
        preset={preset}
        onPresetChange={handlePresetChange}
        custom={custom}
        onCustomChange={setCustom}
        scope={scope}
        onScopeChange={setScope}
        range={analysis.range}
      />

      <KpiCards analysis={analysis} latest={latest} onSelectNumber={setSelected} onShowLatest={openLatest} />

      <TabNav value={tab} onChange={setTab} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'frequency' && <FrequencyTab analysis={analysis} onSelectNumber={setSelected} />}
        {tab === 'streaks' && <StreaksTab analysis={analysis} onSelectNumber={setSelected} />}
        {tab === 'groups' && <GroupsTab analysis={analysis} />}
        {tab === 'pairs' && <PairsTab analysis={analysis} onSelectNumber={setSelected} />}
        {tab === 'markov' && <TabMarkov analysis={analysis} onSelectNumber={setSelected} />}
        {tab === 'calendar' && <TabCalendar analysis={analysis} onSelectNumber={setSelected} />}
        {tab === 'special5' && <TabSpecialDeep analysis={analysis} />}
        {tab === 'clustering' && <TabClustering analysis={analysis} onSelectNumber={setSelected} />}
        {tab === 'backtest' && <TabBacktest analysis={analysis} />}
      </div>

      <footer className="pt-4 text-center text-xs text-slate-600">
        Dữ liệu: vietnam-lottery-xsmb-analysis · Cập nhật tự động hằng ngày lúc 18:35
      </footer>

      {selected !== null && <NumberDetailModal analysis={analysis} number={selected} onClose={closeNumber} />}
      {showLatest && <LatestResultModal dataset={dataset} latest={latest} onClose={closeLatest} />}
    </div>
  )
}
