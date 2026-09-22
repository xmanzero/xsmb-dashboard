import { CalendarDays, Flame, Hourglass, Trophy, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Analysis } from '../hooks/useAnalysis.ts'
import { numberAt, type FullDraw } from '../services/dataLoader.ts'
import { formatDate, formatInt, formatSignedPercent } from '../utils/format.ts'
import { pad2, rankNumbers } from '../utils/lotteryStats.ts'

interface KpiCardsProps {
  analysis: Analysis
  latest: FullDraw | null
  onSelectNumber: (n: number) => void
  onShowLatest: () => void
}

export function KpiCards({ analysis, latest, onSelectNumber, onShowLatest }: KpiCardsProps) {
  const { dataset, frequency, gan, range, scope } = analysis
  const isLoto = scope === 'all'
  const lastDraw = dataset.size - 1
  const lastDate = dataset.dates[lastDraw]
  const fullLatest = latest?.date === lastDate ? latest : null

  const [hot] = rankNumbers(frequency.counts, 1)
  const hotTies = hot ? frequency.counts.filter((c) => c === hot.value).length - 1 : 0
  const hasDraws = frequency.draws > 0

  const coldest = hasDraws ? [...gan].sort((a, b) => b.current - a.current || a.number - b.number)[0] : undefined

  const special = fullLatest ? String(fullLatest.prizes.special).padStart(5, '0') : pad2(numberAt(dataset, lastDraw, 0))

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Trophy} label="Kỳ quay mới nhất" accent="text-amber-300" onClick={onShowLatest} actionLabel="Xem bảng kết quả">
        <p className="text-xs text-slate-400">{formatDate(lastDate)}</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-slate-100 tabular-nums">
          {special.slice(0, -2)}
          <span className="text-amber-300">{special.slice(-2)}</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Giải ĐB{fullLatest && <> · G1 <span className="font-mono text-slate-300">{String(fullLatest.prizes.prize1).padStart(5, '0')}</span></>}
        </p>
      </KpiCard>

      <KpiCard
        icon={Flame}
        label={isLoto ? 'Lô về nhiều nhất' : 'Đề về nhiều nhất'}
        accent="text-orange-400"
        onClick={hot && hasDraws ? () => onSelectNumber(hot.number) : undefined}
        actionLabel="Xem chi tiết số"
      >
        {hot && hasDraws ? (
          <>
            <BigNumber value={hot.number} className="text-orange-300" />
            <p className="mt-1 text-xs text-slate-400">
              {formatInt(hot.value)} lượt ·{' '}
              <span className="text-orange-300">{formatSignedPercent(hot.value / frequency.expected - 1)}</span> so với mức trung bình
              {hotTies > 0 && <> · đồng hạng với {hotTies} số khác</>}
            </p>
          </>
        ) : (
          <NoData />
        )}
      </KpiCard>

      <KpiCard
        icon={Hourglass}
        label={isLoto ? 'Lô gan nhất' : 'Đề gan nhất'}
        accent="text-sky-400"
        onClick={coldest ? () => onSelectNumber(coldest.number) : undefined}
        actionLabel="Xem chi tiết số"
      >
        {coldest ? (
          <>
            <BigNumber value={coldest.number} className="text-sky-300" />
            <p className="mt-1 text-xs text-slate-400">
              {formatInt(coldest.current)} kỳ chưa về · kỷ lục {formatInt(coldest.max)} kỳ
              {coldest.lastSeen && <> · lần cuối {formatDate(coldest.lastSeen)}</>}
            </p>
          </>
        ) : (
          <NoData />
        )}
      </KpiCard>

      <KpiCard icon={CalendarDays} label="Phạm vi phân tích" accent="text-violet-400">
        <p className="text-3xl font-bold text-slate-100 tabular-nums">
          {formatInt(frequency.draws)} <span className="text-base font-medium text-slate-400">kỳ</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {hasDraws ? `${formatDate(dataset.dates[range.from])} – ${formatDate(dataset.dates[range.to - 1])}` : 'Không có dữ liệu'} ·{' '}
          {isLoto ? `${formatInt(frequency.total)} con lô` : 'chỉ giải ĐB'}
        </p>
      </KpiCard>
    </div>
  )
}

interface KpiCardProps {
  icon: LucideIcon
  label: string
  accent: string
  children: ReactNode
  onClick?: () => void
  actionLabel?: string
}

function KpiCard({ icon: Icon, label, accent, children, onClick, actionLabel }: KpiCardProps) {
  const body = (
    <>
      <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${accent}`}>
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </>
  )
  const base = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left'

  if (!onClick) return <div className={base}>{body}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      title={actionLabel}
      className={`${base} transition hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-sky-400`}
    >
      {body}
    </button>
  )
}

function BigNumber({ value, className }: { value: number; className: string }) {
  return <p className={`font-mono text-3xl font-bold tabular-nums ${className}`}>{pad2(value)}</p>
}

function NoData() {
  return <p className="text-3xl font-bold text-slate-600">—</p>
}
