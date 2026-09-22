import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  subtitle?: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}

export function Panel({ title, subtitle, icon: Icon, actions, footer, children, className = '' }: PanelProps) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/60 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            {Icon && <Icon className="size-4 text-slate-400" aria-hidden />}
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="flex min-w-0 flex-1 flex-col px-3 pb-3 pt-2">{children}</div>
      {footer && <footer className="border-t border-slate-800 px-5 py-3 text-xs text-slate-400">{footer}</footer>}
    </section>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
      {message}
    </div>
  )
}
