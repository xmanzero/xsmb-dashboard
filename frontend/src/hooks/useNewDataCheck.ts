import { useEffect, useState } from 'react'

import { loadLatestDraw } from '../services/dataLoader.ts'

/** How often an open tab checks for a newer draw. Results change once a day, so this is plenty. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * Returns the date of a draw newer than `lastDate` once one has been published, or null.
 * Checks periodically and whenever the tab becomes visible again, so a dashboard left open
 * overnight notices the new data.
 */
export function useNewDataCheck(lastDate: string): string | null {
  const [newDate, setNewDate] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const latest = await loadLatestDraw()
      if (!cancelled && latest && latest.date > lastDate) setNewDate(latest.date)
    }
    const timer = window.setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [lastDate])

  return newDate
}
