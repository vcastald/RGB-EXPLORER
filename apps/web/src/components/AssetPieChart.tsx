import { useState, useMemo } from 'react'
import { Transaction, AssetType, Denomination } from '../types/transaction'
import { formatAmount } from '../utils/formatters'

interface AssetPieChartProps {
  transactions: Transaction[]
  selectedAsset: 'ALL' | AssetType
  onSelectAsset: (asset: 'ALL' | AssetType) => void
  denomination: Denomination
}

// Estimated market rates in USD for conversions
const RATES_IN_USD: Record<AssetType, number> = {
  USDT: 1.0,
  XAUT: 2680.0, // 1 oz Gold in USD
  BTC: 67500.0,  // 1 BTC in USD
}

function formatConverted(val: number, denomination: Denomination): string {
  if (denomination === 'USD') {
    return '$' + Math.round(val).toLocaleString('it-IT')
  }
  if (val < 0.0001 && val > 0) {
    return val.toFixed(6) + ' BTC'
  }
  return val.toFixed(4) + ' BTC'
}

export function AssetPieChart({
  transactions,
  selectedAsset,
  onSelectAsset,
  denomination,
}: AssetPieChartProps) {
  const [hoveredAsset, setHoveredAsset] = useState<AssetType | null>(null)

  const stats = useMemo(() => {
    const settled = transactions.filter((t) => t.status === 'settled')

    const usdtAmount = settled
      .filter((t) => t.asset === 'USDT')
      .reduce((sum, t) => sum + t.amount, 0)
    const xautAmount = settled
      .filter((t) => t.asset === 'XAUT')
      .reduce((sum, t) => sum + t.amount, 0)
    const btcAmount = settled
      .filter((t) => t.asset === 'BTC')
      .reduce((sum, t) => sum + t.amount, 0)

    const usdtUsd = usdtAmount * RATES_IN_USD.USDT
    const xautUsd = xautAmount * RATES_IN_USD.XAUT
    const btcUsd = btcAmount * RATES_IN_USD.BTC
    const totalUsd = usdtUsd + xautUsd + btcUsd || 1
    const totalConverted = denomination === 'USD' ? totalUsd : totalUsd / RATES_IN_USD.BTC

    return {
      totalConverted,
      assets: [
        {
          asset: 'USDT' as AssetType,
          name: 'Tether USD',
          protocol: 'RGB20 (LN)',
          amount: usdtAmount,
          convertedValue: denomination === 'USD' ? usdtUsd : usdtUsd / RATES_IN_USD.BTC,
          percent: (usdtUsd / totalUsd) * 100,
          color: '#10b981', // emerald-500
          hoverColor: '#34d399',
        },
        {
          asset: 'XAUT' as AssetType,
          name: 'Tether Gold',
          protocol: 'RGB20 (LN)',
          amount: xautAmount,
          convertedValue: denomination === 'USD' ? xautUsd : xautUsd / RATES_IN_USD.BTC,
          percent: (xautUsd / totalUsd) * 100,
          color: '#fbbf24', // amber-400
          hoverColor: '#fcd34d',
        },
        {
          asset: 'BTC' as AssetType,
          name: 'Bitcoin Native',
          protocol: 'Lightning',
          amount: btcAmount,
          convertedValue: denomination === 'USD' ? btcUsd : btcAmount,
          percent: (btcUsd / totalUsd) * 100,
          color: '#f97316', // orange-500
          hoverColor: '#fb923c',
        },
      ],
    }
  }, [transactions, denomination])

  // Donut SVG parameters
  const radius = 64
  const strokeWidth = 22
  const circumference = 2 * Math.PI * radius
  let accumulatedPercent = 0

  const activeFocusAsset = hoveredAsset ?? (selectedAsset !== 'ALL' ? selectedAsset : null)
  const activeFocusItem = stats.assets.find((a) => a.asset === activeFocusAsset)

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white sm:text-base">
            Distribuzione Totale Asset
          </h3>
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            Valuta: <strong className="text-amber-400">{denomination}</strong>
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          Quota del volume incassato sui canali Lightning RGB
        </p>
      </div>

      {/* Donut Chart Center Graphic */}
      <div className="relative my-4 flex items-center justify-center">
        <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
          {/* Background circle track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {stats.assets.map((item) => {
            const strokeDasharray = `${(item.percent * circumference) / 100} ${circumference}`
            const strokeDashoffset = -((accumulatedPercent * circumference) / 100)
            accumulatedPercent += item.percent

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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          {activeFocusItem ? (
            <>
              <span className="text-[11px] font-semibold text-slate-400">
                {activeFocusItem.asset}
              </span>
              <span className="text-base font-bold text-white">
                {activeFocusItem.percent.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400">
                ~{formatConverted(activeFocusItem.convertedValue, denomination)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Totale ({denomination})
              </span>
              <span className="text-base sm:text-lg font-bold text-white truncate max-w-[140px]">
                {formatConverted(stats.totalConverted, denomination)}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium">
                {transactions.length} pagamenti
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend & Breakdown per Asset */}
      <div className="space-y-2">
        {stats.assets.map((item) => {
          const isSelected = selectedAsset === item.asset
          return (
            <div
              key={item.asset}
              onClick={() => onSelectAsset(isSelected ? 'ALL' : item.asset)}
              onMouseEnter={() => setHoveredAsset(item.asset)}
              onMouseLeave={() => setHoveredAsset(null)}
              className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition-all ${
                isSelected
                  ? 'border-amber-400/50 bg-slate-800/90 shadow-md'
                  : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              {/* Asset Name & Color Pill */}
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{item.asset}</span>
                    <span className="text-[10px] text-slate-400">({item.name})</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
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
                    {item.percent.toFixed(1)}%
                  </span>{' '}
                  (~{formatConverted(item.convertedValue, denomination)})
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Reset selection button if filtered */}
      {selectedAsset !== 'ALL' && (
        <div className="mt-3 text-center">
          <button
            onClick={() => onSelectAsset('ALL')}
            className="text-xs text-amber-400 hover:underline cursor-pointer"
          >
            ← Mostra tutti gli asset nella lista
          </button>
        </div>
      )}
    </div>
  )
}
