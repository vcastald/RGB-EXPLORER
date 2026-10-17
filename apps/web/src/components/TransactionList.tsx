import { useState, useMemo } from 'react'
import { Transaction, AssetType } from '../types/transaction'
import { TransactionItem } from './TransactionItem'
import { SearchIcon, LightningIcon } from './Icons'

interface TransactionListProps {
  transactions: Transaction[]
}

type FilterAsset = 'ALL' | AssetType

export function TransactionList({ transactions }: TransactionListProps) {
  const [selectedAsset, setSelectedAsset] = useState<FilterAsset>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchAsset = selectedAsset === 'ALL' || tx.asset === selectedAsset
      const query = searchQuery.toLowerCase().trim()
      const matchQuery =
        !query ||
        tx.sender.name.toLowerCase().includes(query) ||
        tx.sender.identifier.toLowerCase().includes(query) ||
        (tx.memo && tx.memo.toLowerCase().includes(query)) ||
        tx.asset.toLowerCase().includes(query)

      return matchAsset && matchQuery
    })
  }, [transactions, selectedAsset, searchQuery])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20 backdrop-blur-sm">
      {/* List Header with Controls */}
      <div className="border-b border-slate-800 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white sm:text-lg">
                Transazioni Ricevute
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-400/20">
                <LightningIcon className="h-3 w-3" />
                Lightning RGB
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Pagamenti in ingresso confermati istantaneamente off-chain
            </p>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[220px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <SearchIcon className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca mittente o causale..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-400 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 mr-1">Filtra asset:</span>
          
          <button
            onClick={() => setSelectedAsset('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedAsset === 'ALL'
                ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm shadow-amber-400/20'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            Tutti ({transactions.length})
          </button>

          <button
            onClick={() => setSelectedAsset('USDT')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedAsset === 'USDT'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm shadow-emerald-500/20'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30'
            }`}
          >
            <span className="font-bold">₮</span> USDT
          </button>

          <button
            onClick={() => setSelectedAsset('XAUT')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedAsset === 'XAUT'
                ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm shadow-amber-400/20'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
            }`}
          >
            <span className="font-bold">Au</span> XAUT
          </button>

          <button
            onClick={() => setSelectedAsset('BTC')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedAsset === 'BTC'
                ? 'bg-orange-500 text-white font-semibold shadow-sm shadow-orange-500/20'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-orange-400 hover:border-orange-500/30'
            }`}
          >
            <span className="font-bold">₿</span> BTC
          </button>
        </div>
      </div>

      {/* List content */}
      <div className="divide-y divide-slate-800/80">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
              <SearchIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">Nessuna transazione trovata</h3>
            <p className="mt-1 text-xs text-slate-400">
              Nessun pagamento in arrivo corrisponde ai criteri di filtro selezionati.
            </p>
            <button
              onClick={() => {
                setSelectedAsset('ALL')
                setSearchQuery('')
              }}
              className="mt-3 text-xs font-medium text-amber-400 hover:underline"
            >
              Azzera filtri
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/40 px-4 py-2.5 text-[11px] text-slate-400 sm:px-6">
        <span>Mostrate {filteredTransactions.length} di {transactions.length} transazioni</span>
        <span className="font-mono">Settlement: Instant Finality (L2/RGB)</span>
      </div>
    </div>
  )
}
