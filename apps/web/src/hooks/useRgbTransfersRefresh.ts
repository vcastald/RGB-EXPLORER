import { useState, useEffect, useCallback, useRef } from 'react'

export interface RgbTransfersRefreshState {
  refreshing: boolean
  lastRefreshed: Date | null
  error: string | null
}

/**
 * Hook to periodically call /api/rgb/transfers/refresh on the backend
 * to sync RGB consignments and transfers from proxies/nodes.
 *
 * @param intervalMs Polling interval in ms (default: 30000 ms = 30s)
 * @param onRefreshed Optional callback invoked after a successful refresh
 */
export function useRgbTransfersRefresh(
  intervalMs: number = 30000,
  onRefreshed?: () => void
) {
  const [state, setState] = useState<RgbTransfersRefreshState>({
    refreshing: false,
    lastRefreshed: null,
    error: null,
  })

  // Keep a stable ref to onRefreshed so interval does not reset if callback changes
  const onRefreshedRef = useRef(onRefreshed)
  useEffect(() => {
    onRefreshedRef.current = onRefreshed
  }, [onRefreshed])

  const refreshTransfers = useCallback(async () => {
    setState((prev) => ({ ...prev, refreshing: true }))
    try {
      const res = await fetch('/api/rgb/transfers/refresh', {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
      })

      if (!res.ok) {
        throw new Error(`Refresh failed: HTTP ${res.status}`)
      }

      const data = (await res.json().catch(() => ({}))) as { refreshed?: boolean; refreshedAt?: string }
      const refreshedDate = data.refreshedAt ? new Date(data.refreshedAt) : new Date()

      setState({
        refreshing: false,
        lastRefreshed: refreshedDate,
        error: null,
      })

      // Notify listener (e.g. to re-fetch wallet transactions)
      onRefreshedRef.current?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh RGB transfers'
      setState((prev) => ({
        ...prev,
        refreshing: false,
        error: message,
      }))
    }
  }, [])

  useEffect(() => {
    // Initial call on mount
    refreshTransfers()

    if (intervalMs > 0) {
      const interval = setInterval(refreshTransfers, intervalMs)
      return () => clearInterval(interval)
    }
  }, [refreshTransfers, intervalMs])

  return {
    ...state,
    refresh: refreshTransfers,
  }
}

// Aliases for compatibility
export const useRgbFrame = useRgbTransfersRefresh
export const useTransfersRefreshFrame = useRgbTransfersRefresh
