import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { AgentChat } from './components/AgentChat'
import sampleTransactionsData from './data/transactions.json'
import { Transaction, Denomination } from './types/transaction'
import { useNodeStatus } from './hooks/useNodeStatus'

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>('Checking…')
  const [transactions] = useState<Transaction[]>(sampleTransactionsData as Transaction[])
  const [denomination, setDenomination] = useState<Denomination>('USD')
  const [depositAddress, setDepositAddress] = useState<string | null>(null)

  // Live node status hook querying /api/node/status
  const { isOnline, refresh: refreshNode } = useNodeStatus(15000)

  // Fetch deposit address from backend
  useEffect(() => {
    const controller = new AbortController()

    async function fetchDepositAddress() {
      try {
        const response = await fetch('/api/wallet/deposit-addresses', {
          signal: controller.signal,
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
            signal: controller.signal,
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
    }

    fetchDepositAddress()
    return () => controller.abort()
  }, [isOnline])

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
        onRefreshNode={refreshNode}
      />
      
      {/* 2-Column App Canvas: Left: Agent Chat UI, Right: Shifted Dashboard */}
      <main className="flex-1 flex flex-col lg:flex-row min-w-0">
        <AgentChat />
        
        <div className="flex-1 min-w-0 overflow-y-auto">
          <Dashboard
            transactions={transactions}
            nodeOnline={isOnline}
            depositAddress={depositAddress}
            denomination={denomination}
            onDenominationChange={setDenomination}
          />
        </div>
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
