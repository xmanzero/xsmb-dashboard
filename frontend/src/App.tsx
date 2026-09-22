import { LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react'

import { Dashboard } from './components/Dashboard.tsx'
import { useDataset } from './hooks/useDataset.ts'

export default function App() {
  const state = useDataset()

  if (state.status === 'ready') return <Dashboard dataset={state.dataset} latest={state.latest} />

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {state.status === 'loading' ? (
        <p className="flex items-center gap-3 text-slate-400" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          Đang tải dữ liệu xổ số…
        </p>
      ) : (
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center" role="alert">
          <TriangleAlert className="size-8 text-red-400" aria-hidden />
          <p className="text-sm text-red-200">{state.message}</p>
          <button
            type="button"
            onClick={state.retry}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700"
          >
            <RotateCw className="size-4" aria-hidden />
            Thử lại
          </button>
        </div>
      )}
    </main>
  )
}
