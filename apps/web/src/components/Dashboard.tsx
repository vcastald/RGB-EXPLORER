import { Transaction } from '../types/transaction'
import { StatsCards } from './StatsCards'
import { TransactionList } from './TransactionList'
import { LightningIcon } from './Icons'

interface DashboardProps {
  transactions: Transaction[]
  nodeOnline: boolean | null
  nodePubkey?: string
}

export function Dashboard({ transactions, nodeOnline, nodePubkey }: DashboardProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Node Alert if Offline */}
      {nodeOnline === false && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 font-bold">
              !
            </span>
            <div>
              <p className="font-semibold text-rose-200">Nodo Lightning non raggiungibile</p>
              <p className="text-rose-300/80">
                Il container Docker su porta 3901 o l&apos;endpoint backend <code className="font-mono bg-rose-950/60 px-1 py-0.5 rounded">/api/node/status</code> non rispondono.
              </p>
            </div>
          </div>
          <span className="hidden font-mono text-[11px] text-rose-400 sm:inline">
            npm run node:setup
          </span>
        </div>
      )}

      {/* Dashboard Headline */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Dashboard Incassi Lightning RGB
            </h2>
            {nodeOnline === true && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                Nodo Connesso
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Monitora i flussi di cassa in ingresso per <strong className="text-emerald-400 font-medium">USDT</strong>,{' '}
            <strong className="text-amber-300 font-medium">XAUT</strong> e{' '}
            <strong className="text-orange-400 font-medium">BTC</strong> sui canali Lightning abilitati RGB.
          </p>
        </div>

        {nodePubkey && (
          <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2 text-xs">
            <span className="text-amber-400"><LightningIcon className="h-4 w-4" /></span>
            <span className="text-slate-400">Pubkey:</span>
            <span className="font-mono text-slate-200 truncate max-w-[180px]">{nodePubkey}</span>
          </div>
        )}
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
