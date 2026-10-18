import { useState, useMemo } from 'react'
import { Transaction, AssetType, Denomination, ChannelLiquidity, TargetAllocation as TargetAllocationType } from '../types/transaction'
import { formatAmount } from '../utils/formatters'
import type { MarketQuote } from '../hooks/useFrame'

interface AssetPieChartProps {
  transactions: Transaction[]
  selectedAsset: 'ALL' | AssetType
  onSelectAsset: (asset: 'ALL' | AssetType) => void
  denomination: Denomination
  loading?: boolean
  quotes?: MarketQuote[]
  channelLiquidity?: ChannelLiquidity | null
  targetAllocation?: TargetAllocationType
}

// Fallback rates in USD if quotes are not yet loaded
const DEFAULT_RATES_IN_USD: Record<AssetType, number> = {
  USDT: 1.0,
  XAUT: 2680.0,
  BTC: 80000.0,
  BTC_LN: 80000.0,
}

function formatConverted(val: number, denomination: Denomination): string {
  if (denomination === 'USD') {
    if (val === 0) return '$0'
    if (val < 10) {
      return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    return '$' + Math.round(val).toLocaleString('en-US')
  }
  if (val === 0) return '0 BTC'
  if (val < 0.0001 && val > 0) {
    return val.toFixed(8) + ' BTC'
  }
  if (val < 1) {
    return val.toFixed(6) + ' BTC'
  }
  return val.toFixed(4) + ' BTC'
}

function formatPercent(pct: number): string {
  if (pct === 0) return '0.0%'
  if (pct < 0.1) return pct.toFixed(2) + '%'
  return pct.toFixed(1) + '%'
}

export function AssetPieChart({
  transactions,
  selectedAsset,
  onSelectAsset,
  denomination,
  loading = false,
  quotes,
  channelLiquidity,
  targetAllocation,
}: AssetPieChartProps) {
  const [hoveredAsset, setHoveredAsset] = useState<AssetType | null>(null)

  const stats = useMemo(() => {
    // Dynamic market rates from Kaleido quotes if available
    const btcUsdtQuote = quotes?.find((q) => q.pair === 'BTC/USDT')
    const btcPrice = btcUsdtQuote?.price && btcUsdtQuote.price > 0 ? btcUsdtQuote.price : DEFAULT_RATES_IN_USD.BTC

    const usdtXautQuote = quotes?.find((q) => q.pair === 'USDT/XAUT')
    const xautPrice =
      usdtXautQuote?.inversePrice && usdtXautQuote.inversePrice > 0
        ? usdtXautQuote.inversePrice
        : DEFAULT_RATES_IN_USD.XAUT

    const rates: Record<AssetType, number> = {
      USDT: 1.0,
      XAUT: xautPrice,
      BTC: btcPrice,
      BTC_LN: btcPrice,
    }

    // Only settled transactions for USDT and XAUT
    const usdtTxs = transactions.filter((t) => t.asset === 'USDT' && t.status === 'settled')
    const usdtAmount = Math.max(
      0,
      usdtTxs.reduce((sum, t) => sum + (t.direction === 'outgoing' ? -t.amount : t.amount), 0)
    )

    const xautTxs = transactions.filter((t) => t.asset === 'XAUT' && t.status === 'settled')
    const xautAmount = Math.max(
      0,
      xautTxs.reduce((sum, t) => sum + (t.direction === 'outgoing' ? -t.amount : t.amount), 0)
    )

    // Calculate confirmed on-chain BTC (strictly settled and confirmed in a block, excluding unconfirmed/mempool txs)
    const onchainBtcTxs = transactions.filter(
      (t) =>
        (t.asset === 'BTC' || t.asset === 'BTC_LN') &&
        t.paymentType !== 'lightning' &&
        !t.paymentHash &&
        t.status === 'settled' &&
        t.blockHeight != null &&
        t.blockHeight > 0
    )
    const btcOnChainAmount = Math.max(
      0,
      onchainBtcTxs.reduce((sum, t) => sum + (t.direction === 'outgoing' ? -t.amount : t.amount), 0)
    )

    // Calculate settled Bitcoin funds on Lightning channels (strictly BTC, excluding RGB tokens)
    const btcLightningTxs = transactions.filter(
      (t) =>
        (t.asset === 'BTC' || t.asset === 'BTC_LN') &&
        (t.paymentType === 'lightning' || Boolean(t.paymentHash)) &&
        t.status === 'settled'
    )
    const btcLightningAmount = Math.max(
      0,
      btcLightningTxs.reduce((sum, t) => sum + (t.direction === 'outgoing' ? -t.amount : t.amount), 0)
    )

    // Strictly count Bitcoin liquidity on Lightning:
    // Prioritizes settled Lightning payments (e.g. 0.00001 BTC = 1,000 sats).
    // If no payments exist yet, falls back to the local channel balance (or 0).
    const lightningLiquidityBtc =
      btcLightningAmount > 0
        ? btcLightningAmount
        : channelLiquidity?.localBalanceBtc != null && channelLiquidity.localBalanceBtc > 0
        ? channelLiquidity.localBalanceBtc
        : 0

    const usdtUsd = usdtAmount * rates.USDT
    const xautUsd = xautAmount * rates.XAUT
    const btcOnChainUsd = btcOnChainAmount * rates.BTC
    const lnUsd = lightningLiquidityBtc * rates.BTC_LN

    const totalUsd = usdtUsd + xautUsd + btcOnChainUsd + lnUsd || 1
    const totalConverted = denomination === 'USD' ? totalUsd : totalUsd / rates.BTC

    const rawAssets = [
      {
        asset: 'USDT' as AssetType,
        name: 'Tether USD',
        protocol: 'RGB20 (On-Chain)',
        amount: usdtAmount,
        convertedValue: denomination === 'USD' ? usdtUsd : usdtUsd / rates.BTC,
        percent: (usdtUsd / totalUsd) * 100,
        targetPercent: targetAllocation?.usdt,
        color: '#10b981', // emerald-500
        hoverColor: '#34d399',
      },
      {
        asset: 'XAUT' as AssetType,
        name: 'Tether Gold',
        protocol: 'RGB20 (On-Chain)',
        amount: xautAmount,
        convertedValue: denomination === 'USD' ? xautUsd : xautUsd / rates.BTC,
        percent: (xautUsd / totalUsd) * 100,
        targetPercent: targetAllocation?.xaut,
        color: '#fbbf24', // amber-400
        hoverColor: '#fcd34d',
      },
      {
        asset: 'BTC' as AssetType,
        name: 'Bitcoin On-Chain',
        protocol: 'On-Chain (Node)',
        amount: btcOnChainAmount,
        convertedValue: denomination === 'USD' ? btcOnChainUsd : btcOnChainAmount,
        percent: (btcOnChainUsd / totalUsd) * 100,
        targetPercent: targetAllocation?.btc,
        color: '#f97316', // orange-500
        hoverColor: '#fb923c',
      },
      {
        asset: 'BTC_LN' as AssetType,
        name: 'BTC on Lightning',
        protocol: 'Lightning Network',
        amount: lightningLiquidityBtc,
        convertedValue: denomination === 'USD' ? lnUsd : lightningLiquidityBtc,
        percent: (lnUsd / totalUsd) * 100,
        targetPercent: targetAllocation?.btc,
        color: '#6366f1', // indigo-500
        hoverColor: '#818cf8',
      },
    ]

    // Visual min-slice percentage so tiny amounts remain visible and clickable on SVG donut
    const rawSumWithMin = rawAssets.reduce(
      (sum, a) => sum + (a.percent > 0 ? Math.max(a.percent, 3.5) : 0),
      0
    )
    const assets = rawAssets.map((a) => ({
      ...a,
      visualPercent:
        rawSumWithMin > 0 && a.percent > 0
          ? (Math.max(a.percent, 3.5) / rawSumWithMin) * 100
          : 0,
    }))

    return {
      totalConverted,
      assets,
    }
  }, [transactions, denomination, quotes, channelLiquidity, targetAllocation])

  // Donut SVG parameters
  const radius = 64
  const strokeWidth = 22
  const circumference = 2 * Math.PI * radius
  let accumulatedPercent = 0

  const activeFocusAsset = hoveredAsset ?? (selectedAsset !== 'ALL' ? selectedAsset : null)
  const activeFocusItem = stats.assets.find((a) => a.asset === activeFocusAsset)

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white sm:text-base">
            Total Asset Distribution
          </h3>
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            Currency: <strong className="text-amber-400">{denomination}</strong>
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          Treasury breakdown across on-chain RGB tokens, on-chain Bitcoin, and Lightning channels
        </p>
      </div>

      {loading ? (
        /* Loading Skeleton */
        <div className="my-2 flex flex-col items-center justify-center py-2 animate-pulse">
          <div className="relative flex items-center justify-center h-[160px] w-[160px]">
            <div className="h-28 w-28 rounded-full border-4 border-slate-800 border-t-amber-400 animate-spin" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Loading</span>
              <span className="text-xs font-semibold text-slate-300">Syncing node data…</span>
            </div>
          </div>

          <div className="w-full space-y-1.5 mt-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 p-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-slate-800" />
                  <div className="space-y-1">
                    <div className="h-3 w-16 rounded bg-slate-800" />
                    <div className="h-2 w-20 rounded bg-slate-800/60" />
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="h-3.5 w-20 rounded bg-slate-800 ml-auto" />
                  <div className="h-2 w-12 rounded bg-slate-800/60 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Donut Chart Center Graphic */}
          <div className="relative my-1.5 flex items-center justify-center flex-shrink-0">
            <svg width="140" height="140" viewBox="0 0 200 200" className="transform -rotate-90">
              {/* Background circle track */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke="var(--color-slate-800)"
                strokeWidth={strokeWidth}
              />

              {/* Slices */}
              {stats.assets.map((item) => {
                const strokeDasharray = `${(item.visualPercent * circumference) / 100} ${circumference}`
                const strokeDashoffset = -((accumulatedPercent * circumference) / 100)
                accumulatedPercent += item.visualPercent

                const isSelected = selectedAsset === item.asset
                const isHovered = hoveredAsset === item.asset

                return (
                  <circle
                    key={item.asset}
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="transparent"
                    stroke={isHovered ? item.hoverColor : item.color}
                    strokeWidth={isHovered || isSelected ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoveredAsset(item.asset)}
                    onMouseLeave={() => setHoveredAsset(null)}
                    onClick={() =>
                      onSelectAsset(selectedAsset === item.asset ? 'ALL' : item.asset)
                    }
                  />
                )
              })}
            </svg>

            {/* Center label inside Donut */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-1">
              {activeFocusItem ? (
                <>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {activeFocusItem.asset}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {formatPercent(activeFocusItem.percent)}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    ~{formatConverted(activeFocusItem.convertedValue, denomination)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                    Total ({denomination})
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white truncate max-w-[120px]">
                    {formatConverted(stats.totalConverted, denomination)}
                  </span>
                  <span className="text-[9px] text-emerald-400 font-medium">
                    {transactions.length} transactions
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Legend & Breakdown per Asset with Scrollbar */}
          <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
            {stats.assets.map((item) => {
              const isSelected = selectedAsset === item.asset
              return (
                <div
                  key={item.asset}
                  onClick={() => onSelectAsset(isSelected ? 'ALL' : item.asset)}
                  onMouseEnter={() => setHoveredAsset(item.asset)}
                  onMouseLeave={() => setHoveredAsset(null)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-2.5 py-1.5 transition-all ${
                    isSelected
                      ? 'border-amber-400/50 bg-slate-800/90 shadow-md'
                      : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Asset Name & Color Pill */}
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{item.asset}</span>
                        <span className="text-[10px] text-slate-400">({item.name})</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {item.protocol}
                      </div>
                    </div>
                  </div>

                  {/* Amount & Converted Value */}
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-100">
                      {formatAmount(item.amount, item.asset)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {formatPercent(item.percent)}
                      </span>
                      {item.targetPercent != null && (
                        <span
                          className="ml-1 text-[9px] font-mono text-slate-400"
                          title={`Target: ${item.targetPercent}%`}
                        >
                          (tgt {item.targetPercent}%)
                        </span>
                      )}{' '}
                      (~{formatConverted(item.convertedValue, denomination)})
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reset selection button if filtered */}
          {selectedAsset !== 'ALL' && (
            <div className="mt-1.5 text-center flex-shrink-0">
              <button
                onClick={() => onSelectAsset('ALL')}
                className="text-[11px] text-amber-400 hover:underline cursor-pointer"
              >
                ← Show all assets in transaction list
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

