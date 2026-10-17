import { MarketQuote } from '../hooks/useFrame'
import { AssetBadgeIcon } from './Icons'

interface MarketQuotesProps {
  quotes: MarketQuote[]
  loading: boolean
  lastUpdated: Date | null
  onRefresh: () => void
}

export function MarketQuotes({
  quotes,
  loading,
  lastUpdated,
  onRefresh,
}: MarketQuotesProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 font-bold text-xs">
            ⇄
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Quotazioni Kaleido Swap
            </h3>
            <p className="text-[11px] text-slate-400">Tassi di cambio per scambi atomici RGB / LN</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Sync 5m
          </span>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Aggiorna quotazioni"
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 text-xs text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
          </button>
        </div>
      </div>

      {/* Quotes Cards Grid */}
      <div className="mt-3.5 space-y-2.5">
        {quotes.map((quote) => {
          const isBtcUsdt = quote.pair === 'BTC/USDT'
          const isBtcXaut = quote.pair === 'BTC/XAUT'

          return (
            <div
              key={quote.pair}
              className="group flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 transition-all hover:border-slate-700/80 hover:bg-slate-900/40"
            >
              {/* Pair info with badges */}
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-1.5">
                  <AssetBadgeIcon
                    asset={quote.baseTicker as any}
                    className="h-6 w-6 text-[10px] ring-2 ring-slate-950"
                  />
                  <AssetBadgeIcon
                    asset={quote.quoteTicker as any}
                    className="h-6 w-6 text-[10px] ring-2 ring-slate-950"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white font-mono">
                      {quote.pair}
                    </span>
                    <span className="rounded bg-slate-800/80 px-1 py-0.2 text-[9px] text-slate-400 font-mono">
                      {isBtcUsdt ? 'Spot' : isBtcXaut ? 'Gold Ratio' : 'Stable/Gold'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    1 {quote.baseTicker}
                  </span>
                </div>
              </div>

              {/* Price Display */}
              <div className="text-right">
                <div className="text-xs font-bold text-amber-300 font-mono">
                  ≈ {quote.formattedPrice}
                </div>
                {quote.inverseFormatted && (
                  <div className="text-[10px] text-slate-400 font-mono">
                    (1 XAUT ≈ {quote.inverseFormatted})
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-800/60 pt-2.5 text-[10px] text-slate-400">
        <span>Fonte: Kaleido SDK Maker</span>
        <span>
          {lastUpdated
            ? `Aggiornato alle ${lastUpdated.toLocaleTimeString('it-IT')}`
            : 'In aggiornamento...'}
        </span>
      </div>
    </div>
  )
}
