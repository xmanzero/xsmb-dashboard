import { useCallback, useEffect, useState } from 'react'

import { loadDataset, loadLatestDraw, type Dataset, type FullDraw } from '../services/dataLoader.ts'

export type DatasetState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; dataset: Dataset; latest: FullDraw | null }

/** Loads the dataset and the full latest draw in parallel. */
export function useDataset(): DatasetState {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<DatasetState>({ status: 'loading' })
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadDataset(), loadLatestDraw()])
      .then(([dataset, latest]) => {
        if (!cancelled) setState({ status: 'ready', dataset, latest })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : String(err), retry })
      })
    return () => {
      cancelled = true
    }
  }, [attempt, retry])

  return state
}
