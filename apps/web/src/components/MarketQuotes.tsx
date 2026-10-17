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
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 font-bold text-xs">
            ⇄
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Kaleido Swap Quotes
            </h3>
            <p className="text-[11px] text-slate-400">Exchange rates for RGB / Lightning atomic swaps</p>
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
            title="Refresh market quotes"
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 text-xs text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
          </button>
        </div>
      </div>

      {/* Quotes Cards Grid */}
      <div className="my-2 flex-1 min-h-0 space-y-2 overflow-y-auto custom-scrollbar">
        {loading && quotes.length === 0 ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-11 rounded-lg bg-slate-800/80" />
                  <div className="space-y-1">
                    <div className="h-3 w-16 rounded bg-slate-800" />
                    <div className="h-2 w-20 rounded bg-slate-800/60" />
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="h-3.5 w-24 rounded bg-slate-800 ml-auto" />
                  <div className="h-2 w-14 rounded bg-slate-800/60 ml-auto" />
                </div>
              </div>
            ))}
            <p className="text-center text-[10px] text-slate-400 py-1 font-mono">
              Loading market quotes...
            </p>
          </div>
        ) : (
          quotes.map((quote) => {
            const isBtcUsdt = quote.pair === 'BTC/USDT'
            const isBtcXaut = quote.pair === 'BTC/XAUT'

            return (
              <div
                key={quote.pair}
                className="group flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/50 p-2.5 transition-all hover:border-slate-700/80 hover:bg-slate-900/40"
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
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] text-slate-400">
        <span>Source: Kaleido SDK Maker</span>
        <span>
          {lastUpdated
            ? `Updated at ${lastUpdated.toLocaleTimeString('en-US')}`
            : 'Updating...'}
        </span>
      </div>
    </div>
  )
}
