import { ChartNoAxesCombined, Info } from 'lucide-react'

import type { Dataset } from '../services/dataLoader.ts'
import { formatDate, formatInt } from '../utils/format.ts'

export function Header({ dataset }: { dataset: Dataset }) {
  const first = dataset.dates[0]
  const last = dataset.dates[dataset.size - 1]

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 shadow-lg shadow-sky-900/40">
          <ChartNoAxesCombined className="size-6 text-white" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-50">Thống kê Xổ số Miền Bắc</h1>
          <p className="text-sm text-slate-400">
            {formatInt(dataset.size)} kỳ quay · {formatDate(first)} – {formatDate(last)}
          </p>
        </div>
      </div>
      <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
        <Info className="size-4 shrink-0" aria-hidden />
        Số liệu chỉ mô tả quá khứ. Mỗi kỳ quay là ngẫu nhiên và độc lập, thống kê không giúp dự đoán kết quả.
      </p>
    </header>
  )
}
