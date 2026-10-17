import { useState, useEffect, useCallback } from 'react'

export interface MarketQuote {
  pair: string
  baseTicker: string
  quoteTicker: string
  price: number
  formattedPrice: string
  inversePrice?: number
  inverseFormatted?: string
  updatedAt: string
}

export interface QuotesResponse {
  observedAt: string
  quotes: MarketQuote[]
}

const FALLBACK_QUOTES: MarketQuote[] = [
  {
    pair: 'BTC/USDT',
    baseTicker: 'BTC',
    quoteTicker: 'USDT',
    price: 0,
    formattedPrice: '80.845,86 USDT',
    updatedAt: new Date().toISOString(),
  },
  {
    pair: 'BTC/XAUT',
    baseTicker: 'BTC',
    quoteTicker: 'XAUT',
    price: 0,
    formattedPrice: '19,3872 XAUT',
    updatedAt: new Date().toISOString(),
  },
  {
    pair: 'USDT/XAUT',
    baseTicker: 'USDT',
    quoteTicker: 'XAUT',
    price: 0,
    formattedPrice: '0,00024277 XAUT',
    inversePrice: 4119.11,
    inverseFormatted: '4.119,11 USDT',
    updatedAt: new Date().toISOString(),
  },
]

export function useFrame(intervalMs: number = 5 * 60 * 1000) {
  const [quotes, setQuotes] = useState<MarketQuote[]>(FALLBACK_QUOTES)
  const [loading, setLoading] = useState<boolean>(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/quotes', {
        signal: AbortSignal.timeout(4000),
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const data = (await res.json()) as QuotesResponse
      if (data && Array.isArray(data.quotes) && data.quotes.length > 0) {
        setQuotes(data.quotes)
        setLastUpdated(new Date(data.observedAt || Date.now()))
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile aggiornare le quotazioni')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuotes()

    if (intervalMs > 0) {
      const interval = setInterval(fetchQuotes, intervalMs)
      return () => clearInterval(interval)
    }
  }, [fetchQuotes, intervalMs])

  return {
    quotes,
    loading,
    error,
    lastUpdated,
    refresh: fetchQuotes,
  }
}
