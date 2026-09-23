import { useCallback, useEffect, useState } from 'react'

import { loadSpecials, type Dataset } from '../services/dataLoader.ts'

export type SpecialsState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; specials: Int32Array }

/** Full 5-digit special prizes aligned with the dataset, loaded the first time a component needs them. */
export function useSpecials(dataset: Dataset): SpecialsState {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<SpecialsState>({ status: 'loading' })
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSpecials(dataset)
      .then((specials) => {
        if (!cancelled) setState({ status: 'ready', specials })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : String(err), retry })
      })
    return () => {
      cancelled = true
    }
  }, [dataset, attempt, retry])

  return state
}
