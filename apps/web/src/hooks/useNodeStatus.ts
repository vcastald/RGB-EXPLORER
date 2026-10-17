import { useState, useEffect, useCallback } from 'react'

export interface NodeStatusState {
  isOnline: boolean | null // null = checking
  pubkey?: string
  lastChecked?: Date
  loading: boolean
}

export function useNodeStatus(pollIntervalMs = 15000) {
  const [status, setStatus] = useState<NodeStatusState>({
    isOnline: null,
    loading: true,
  })

  const checkStatus = useCallback(async () => {
    setStatus((prev) => ({ ...prev, loading: true }))

    try {
      // 1. Primary call: backend endpoint /api/node/status (proxied by Vite to Fastify)
      const response = await fetch('/api/node/status', {
        signal: AbortSignal.timeout(3000),
      })

      if (response.ok) {
        const data = (await response.json()) as { online: boolean; pubkey?: string }
        if (data.online) {
          setStatus({
            isOnline: true,
            pubkey: data.pubkey,
            lastChecked: new Date(),
            loading: false,
          })
          return
        }
      }
    } catch {
      // Backend may be offline or unreachable; try direct fallback to local node port 3901 if available
      try {
        const fallback = await fetch('http://127.0.0.1:3901/nodeinfo', {
          signal: AbortSignal.timeout(2000),
        })
        if (fallback.ok) {
          const nodeData = (await fallback.json()) as { pubkey?: string }
          if (nodeData.pubkey) {
            setStatus({
              isOnline: true,
              pubkey: nodeData.pubkey,
              lastChecked: new Date(),
              loading: false,
            })
            return
          }
        }
      } catch {
        // Both unreachable
      }
    }

    setStatus({
      isOnline: false,
      pubkey: undefined,
      lastChecked: new Date(),
      loading: false,
    })
  }, [])

  useEffect(() => {
    checkStatus()

    if (pollIntervalMs > 0) {
      const interval = setInterval(checkStatus, pollIntervalMs)
      return () => clearInterval(interval)
    }
  }, [checkStatus, pollIntervalMs])

  return {
    ...status,
    refresh: checkStatus,
  }
}
