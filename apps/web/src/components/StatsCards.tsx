import { Transaction } from '../types/transaction'
import { formatAmount } from '../utils/formatters'
import { AssetBadgeIcon, ArrowDownLeftIcon } from './Icons'

interface StatsCardsProps {
  transactions: Transaction[]
}

export function StatsCards({ transactions }: StatsCardsProps) {
  // Aggregate totals
  const totalUsdt = transactions
    .filter((t) => t.asset === 'USDT' && t.status === 'settled')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalXaut = transactions
    .filter((t) => t.asset === 'XAUT' && t.status === 'settled')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalBtc = transactions
    .filter((t) => t.asset === 'BTC' && t.status === 'settled')
    .reduce((sum, t) => sum + t.amount, 0)

  const countUsdt = transactions.filter((t) => t.asset === 'USDT').length
  const countXaut = transactions.filter((t) => t.asset === 'XAUT').length
  const countBtc = transactions.filter((t) => t.asset === 'BTC').length

  const cards = [
    {
      asset: 'USDT' as const,
      name: 'Tether USD',
      schema: 'RGB20 on LN',
      totalFormatted: formatAmount(totalUsdt, 'USDT'),
      count: countUsdt,
      borderClass: 'border-emerald-500/20 hover:border-emerald-500/40',
      bgGlow: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      textAccent: 'text-emerald-400',
    },
    {
      asset: 'XAUT' as const,
      name: 'Tether Gold',
      schema: 'RGB20 on LN',
      totalFormatted: formatAmount(totalXaut, 'XAUT'),
      count: countXaut,
      borderClass: 'border-amber-500/20 hover:border-amber-500/40',
      bgGlow: 'from-amber-500/10 via-amber-500/5 to-transparent',
      textAccent: 'text-amber-300',
    },
    {
      asset: 'BTC' as const,
      name: 'Bitcoin Native',
      schema: 'Lightning Channel',
      totalFormatted: formatAmount(totalBtc, 'BTC'),
      count: countBtc,
      borderClass: 'border-orange-500/20 hover:border-orange-500/40',
      bgGlow: 'from-orange-500/10 via-orange-500/5 to-transparent',
      textAccent: 'text-orange-400',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.asset}
          className={`relative overflow-hidden rounded-2xl border bg-slate-900/60 p-5 backdrop-blur-sm transition-all duration-200 ${card.borderClass}`}
        >
          {/* Subtle gradient background */}
          <div
            className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br ${card.bgGlow} blur-2xl`}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AssetBadgeIcon asset={card.asset} className="h-7 w-7 text-sm" />
              <div>
                <h3 className="text-sm font-semibold text-white">{card.name}</h3>
                <span className="text-[11px] font-mono text-slate-400">{card.schema}</span>
              </div>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800/80 text-emerald-400">
              <ArrowDownLeftIcon className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-medium text-slate-400">Totale Ricevuto</div>
            <div className={`mt-0.5 text-xl font-bold tracking-tight ${card.textAccent}`}>
              + {card.totalFormatted}
            </div>
            <div className="mt-2 flex items-center text-xs text-slate-400">
              <span className="text-slate-300 font-medium">{card.count}</span>
              <span className="ml-1 text-slate-400">pagamenti registrati</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
