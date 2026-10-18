import { useState, useMemo } from 'react'
import { Transaction, AssetType } from '../types/transaction'
import { TransactionItem } from './TransactionItem'
import { SearchIcon, LightningIcon } from './Icons'

interface TransactionListProps {
  transactions: Transaction[]
  selectedAsset: 'ALL' | AssetType
  onSelectAsset: (asset: 'ALL' | AssetType) => void
  loading?: boolean
}

export function TransactionList({
  transactions,
  selectedAsset,
  onSelectAsset,
  loading = false,
}: TransactionListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const isLightning =
        tx.paymentType === 'lightning' ||
        tx.asset === 'BTC_LN' ||
        Boolean(tx.paymentHash) ||
        Boolean(tx.channelId)

      let matchAsset = true
      if (selectedAsset === 'ALL') {
        matchAsset = true
      } else if (selectedAsset === 'BTC_LN') {
        matchAsset = isLightning && (tx.asset === 'BTC' || tx.asset === 'BTC_LN')
      } else if (selectedAsset === 'BTC') {
        matchAsset = (tx.asset === 'BTC' || tx.asset === 'BTC_LN') && !isLightning
      } else {
        matchAsset = tx.asset === selectedAsset
      }

      const query = searchQuery.toLowerCase().trim()
      const matchQuery =
        !query ||
        tx.sender.name.toLowerCase().includes(query) ||
        tx.sender.identifier.toLowerCase().includes(query) ||
        (tx.memo && tx.memo.toLowerCase().includes(query)) ||
        tx.asset.toLowerCase().includes(query) ||
        (isLightning && 'lightning'.includes(query)) ||
        (!isLightning && 'onchain'.includes(query))

      return matchAsset && matchQuery
    })
  }, [transactions, selectedAsset, searchQuery])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20 backdrop-blur-sm">
      {/* Header with Search and Asset Filter */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white sm:text-base">
              Transactions
            </h3>
            <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-amber-400/20">
              <LightningIcon className="h-2.5 w-2.5" />
              RGB Feed
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            {loading ? 'Loading…' : `${filteredTransactions.length} of ${transactions.length}`}
          </span>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <SearchIcon className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by sender or memo..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-1.5 pl-8 pr-7 text-xs text-slate-100 placeholder-slate-400 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
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

        {/* Filter Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onSelectAsset('ALL')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
              selectedAsset === 'ALL'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>

          <button
            onClick={() => onSelectAsset('USDT')}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${
              selectedAsset === 'USDT'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-emerald-400'
            }`}
          >
            <span className="font-bold">₮</span> USDT
          </button>

          <button
            onClick={() => onSelectAsset('XAUT')}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${
              selectedAsset === 'XAUT'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-amber-300'
            }`}
          >
            <span className="font-bold">Au</span> XAUT
          </button>

          <button
            onClick={() => onSelectAsset('BTC')}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${
              selectedAsset === 'BTC'
                ? 'bg-orange-500 text-white font-bold shadow-sm'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-orange-400'
            }`}
          >
            <span className="font-bold">₿</span> On-Chain
          </button>

          <button
            onClick={() => onSelectAsset('BTC_LN')}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${
              selectedAsset === 'BTC_LN'
                ? 'bg-indigo-500 text-white font-bold shadow-sm'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-indigo-300'
            }`}
          >
            <LightningIcon className="h-3 w-3 text-amber-400" /> Lightning
          </button>
        </div>
      </div>

      {/* Scrollable List Container */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
        {loading ? (
          <div className="divide-y divide-slate-800/40 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-slate-800/80" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 rounded bg-slate-800" />
                    <div className="h-2.5 w-40 rounded bg-slate-800/60" />
                  </div>
                </div>
                <div className="space-y-1.5 text-right">
                  <div className="h-3.5 w-20 rounded bg-slate-800 ml-auto" />
                  <div className="h-2.5 w-12 rounded bg-slate-800/60 ml-auto" />
                </div>
              </div>
            ))}
            <p className="text-center text-[10px] text-slate-400 py-3 font-mono">
              Loading transactions from node...
            </p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400">
              <SearchIcon className="h-5 w-5" />
            </div>
            <h4 className="mt-2 text-xs font-semibold text-white">No transactions found</h4>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Try changing the asset filter or search term.
            </p>
            <button
              onClick={() => {
                onSelectAsset('ALL')
                setSearchQuery('')
              }}
              className="mt-2 text-xs text-amber-400 hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Scroll indicator footer */}
      <div className="border-t border-slate-800/80 bg-slate-950/40 px-3.5 py-2 text-[10px] text-slate-400 flex justify-between items-center">
        <span>Scroll to view transaction history</span>
        <span className="font-mono text-emerald-400">● Live Updates</span>
      </div>
    </div>
  )
}
