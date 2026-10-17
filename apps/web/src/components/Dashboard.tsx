import { Transaction } from '../types/transaction'
import { StatsCards } from './StatsCards'
import { TransactionList } from './TransactionList'

interface DashboardProps {
  transactions: Transaction[]
}

export function Dashboard({ transactions }: DashboardProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Dashboard Headline */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Dashboard Incassi Lightning RGB
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Monitora i flussi di cassa in ingresso per <strong className="text-emerald-400 font-medium">USDT</strong>,{' '}
            <strong className="text-amber-300 font-medium">XAUT</strong> e{' '}
            <strong className="text-orange-400 font-medium">BTC</strong> sui canali Lightning abilitati RGB.
          </p>
        </div>
      </div>

      {/* 1. Stat cards: Totale per asset */}
      <div className="mb-8">
        <StatsCards transactions={transactions} />
      </div>

      {/* 2. Main Transaction feed: Da chi arriva, quanto e cosa */}
      <div>
        <TransactionList transactions={transactions} />
      </div>
    </div>
  )
}
