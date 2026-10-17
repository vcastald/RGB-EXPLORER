import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import sampleTransactionsData from './data/transactions.json'
import { Transaction } from './types/transaction'

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>('Checking…')
  const [transactions] = useState<Transaction[]>(sampleTransactionsData as Transaction[])

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
      <Header apiStatus={apiStatus} />
      
      <main className="flex-1">
        <Dashboard transactions={transactions} />
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>RGB Explorer • Hackathon Project</span>
          <span className="font-mono text-slate-400">Lightning Network + RGB Protocol</span>
        </div>
      </footer>
    </div>
  )
}
