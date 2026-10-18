import { useCallback, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { Transaction, Denomination, ChannelLiquidity, AssetType } from './types/transaction'
import { useNodeStatus } from './hooks/useNodeStatus'

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>('Checking…')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(true)
  const [denomination, setDenomination] = useState<Denomination>('USD')
  const [depositAddress, setDepositAddress] = useState<string | null>(null)
  const [channelLiquidity, setChannelLiquidity] = useState<ChannelLiquidity | null>(null)

  // Theme state: 'dark' (default) or 'light' (white mode)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rgb_theme')
      if (saved === 'light' || saved === 'dark') return saved
    }
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
      root.classList.remove('light')
    }
    localStorage.setItem('rgb_theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  // Live node status hook querying /api/node/status
  const { isOnline, refresh: refreshNode } = useNodeStatus(15000)

  // Fetch deposit address from backend
  const fetchDepositAddress = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/wallet/deposit-addresses', {
        signal,
      })
      if (response.ok) {
        const data = (await response.json()) as { addresses?: Array<{ address: string }> }
        if (data.addresses && data.addresses.length > 0) {
          setDepositAddress(data.addresses[0].address)
          return
        }
        // If no address has been created yet, request a new deposit address
        const createResponse = await fetch('/api/wallet/deposit-addresses', {
          method: 'POST',
          signal,
        })
        if (createResponse.ok) {
          const createData = (await createResponse.json()) as { address?: string }
          if (createData.address) {
            setDepositAddress(createData.address)
          }
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        // Mock fallback address when backend or node is offline
        setDepositAddress('tb1pjpua0jlrm4y9t6acdndggu6l0350qnajhp3gwx85us0q9fqkha7q0wa6l3')
      }
    }
  }, [])

  // Fetch real on-chain BTC transactions, Lightning payments, and on-chain RGB transfers (USDT, XAUT) from Kaleido node
  const fetchTransactions = useCallback(async (signal?: AbortSignal) => {
    try {
      setTransactionsLoading(true)

      const [txResponse, payResponse, transferResponse] = await Promise.all([
        fetch('/api/wallet/transactions', { signal }).catch(() => null),
        fetch('/api/wallet/payments', { signal }).catch(() => null),
        fetch('/api/wallet/transfers', { signal }).catch(() => null),
      ])

      let realBtcTransactions: Transaction[] = []
      let realLightningPayments: Transaction[] = []
      let realRgbTransfers: Transaction[] = []

      if (txResponse && txResponse.ok) {
        const data = (await txResponse.json()) as {
          transactions?: Array<{
            id: string
            txid: string
            timestamp: string
            asset: 'BTC'
            amount: number
            unit: string
            direction?: 'incoming' | 'outgoing'
            status: 'settled' | 'pending'
            blockHeight?: number | null
            sender?: {
              name: string
              identifier: string
              type?: 'node' | 'business' | 'individual' | 'exchange'
            }
            memo?: string
          }>
        }

        if (data && Array.isArray(data.transactions)) {
          realBtcTransactions = data.transactions.map((tx) => ({
            id: tx.id || tx.txid,
            txid: tx.txid,
            timestamp: tx.timestamp,
            asset: 'BTC' as const,
            amount: tx.amount,
            unit: tx.unit || 'BTC',
            direction: tx.direction,
            status: tx.status,
            blockHeight: tx.blockHeight,
            paymentType: 'onchain' as const,
            sender: tx.sender || {
              name: tx.direction === 'outgoing' ? 'Bitcoin On-Chain Transfer' : 'Bitcoin On-Chain Deposit',
              identifier: tx.txid,
              type: 'node',
            },
            memo: tx.memo || 'On-chain Bitcoin transaction',
          }))
        }
      }

      if (payResponse && payResponse.ok) {
        const data = (await payResponse.json()) as {
          payments?: Array<{
            id: string
            paymentHash: string
            timestamp: string
            asset: 'BTC' | string
            amount: number
            unit: string
            direction?: 'incoming' | 'outgoing'
            status: 'settled' | 'pending' | 'failed'
            sender?: {
              name: string
              identifier: string
              type?: 'node' | 'business' | 'individual' | 'exchange'
            }
            memo?: string
          }>
          channelLiquidity?: ChannelLiquidity
        }

        if (data && data.channelLiquidity) {
          setChannelLiquidity(data.channelLiquidity)
        }

        if (data && Array.isArray(data.payments)) {
          realLightningPayments = data.payments.map((p) => ({
            id: p.id || p.paymentHash,
            paymentHash: p.paymentHash,
            timestamp: p.timestamp,
            asset: 'BTC' as const,
            amount: p.amount,
            unit: p.unit || 'BTC',
            direction: p.direction,
            status: p.status === 'failed' ? 'pending' : p.status,
            paymentType: 'lightning' as const,
            sender: p.sender || {
              name: p.direction === 'outgoing' ? 'Lightning Payment Sent' : 'Lightning Payment Received',
              identifier: p.paymentHash,
              type: 'node',
            },
            memo: p.memo || 'Lightning Network payment',
          }))
        }
      }

      if (transferResponse && transferResponse.ok) {
        const data = (await transferResponse.json()) as {
          transfers?: Array<{
            id: string
            txid?: string | null
            timestamp: string
            asset: 'USDT' | 'XAUT' | 'BTC' | string
            amount: number
            unit: string
            direction?: 'incoming' | 'outgoing'
            status: 'settled' | 'pending' | 'failed'
            sender?: {
              name: string
              identifier: string
              type?: 'node' | 'business' | 'individual' | 'exchange'
            }
            memo?: string
            recipientId?: string | null
            receiveUtxo?: string | null
          }>
        }

        if (data && Array.isArray(data.transfers)) {
          realRgbTransfers = data.transfers.map((t) => ({
            id: t.id,
            txid: t.txid ?? undefined,
            timestamp: t.timestamp,
            asset: (t.asset === 'XAUT' ? 'XAUT' : 'USDT') as AssetType,
            amount: t.amount,
            unit: t.unit || t.asset,
            direction: t.direction,
            status: t.status,
            paymentType: 'onchain' as const,
            sender: t.sender || {
              name: t.direction === 'outgoing' ? 'RGB On-Chain Transfer' : 'RGB On-Chain Deposit',
              identifier: t.txid || t.recipientId || t.id,
              type: 'node',
            },
            memo: t.memo || `On-chain RGB ${t.asset} transfer`,
          }))
        }
      }

      const merged = [
        ...realBtcTransactions,
        ...realLightningPayments,
        ...realRgbTransfers,
      ].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setTransactions(merged)
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setTransactions((prev) => prev)
      }
    } finally {
      setTransactionsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchDepositAddress(controller.signal)
    fetchTransactions(controller.signal)

    const interval = setInterval(() => {
      fetchTransactions()
    }, 20000)

    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [isOnline, fetchDepositAddress, fetchTransactions])

  const handleRefresh = useCallback(() => {
    setTransactionsLoading(true)
    refreshNode()
    fetchDepositAddress()
    fetchTransactions()
  }, [refreshNode, fetchDepositAddress, fetchTransactions])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable')
        return response.json() as Promise<{ status: string }>
      })
      .then((data) => setApiStatus(data.status === 'ok' ? 'Connected' : 'Unavailable'))
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) setApiStatus('Offline (Demo Mode)')
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      <Header
        apiStatus={apiStatus}
        nodeOnline={isOnline}
        depositAddress={depositAddress}
        onRefreshNode={handleRefresh}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      
      {/* Main Dashboard Canvas */}
      <main className="flex-1 min-w-0">
        <Dashboard
          transactions={transactions}
          transactionsLoading={transactionsLoading}
          nodeOnline={isOnline}
          depositAddress={depositAddress}
          denomination={denomination}
          onDenominationChange={setDenomination}
          channelLiquidity={channelLiquidity}
          onRefreshTransactions={fetchTransactions}
        />
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>RGB Explorer • Hackathon Project</span>
          <span className="font-mono text-slate-400">Lightning Network + RGB Protocol</span>
        </div>
      </footer>
    </div>
  )
}
