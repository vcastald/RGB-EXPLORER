import { useState } from 'react'
import { Transaction } from '../types/transaction'
import { formatAmount, formatTimeAgo, shortenIdentifier } from '../utils/formatters'
import { AssetBadgeIcon, LightningIcon, CheckCircleIcon } from './Icons'

interface TransactionItemProps {
  transaction: Transaction
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Accent color by asset
  const getAssetBadge = () => {
    switch (transaction.asset) {
      case 'USDT':
        return {
          label: 'USDT',
          schema: 'RGB20',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          amountColor: 'text-emerald-400',
        }
      case 'XAUT':
        return {
          label: 'XAUT',
          schema: 'RGB20',
          badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          amountColor: 'text-amber-300',
        }
      case 'BTC':
        return {
          label: 'BTC',
          schema: 'LN Native',
          badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          amountColor: 'text-orange-400',
        }
    }
  }

  const assetStyle = getAssetBadge()

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="group cursor-pointer border-b border-slate-800/80 bg-slate-900/40 px-4 py-4 transition-all duration-150 hover:bg-slate-800/50 sm:px-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Da chi arriva & Asset */}
        <div className="flex items-center gap-3.5">
          {/* Asset Icon */}
          <div className="relative flex-shrink-0">
            <AssetBadgeIcon asset={transaction.asset} className="h-10 w-10 text-base" />
            <span
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-amber-400 ring-2 ring-slate-900"
              title="Lightning Network"
            >
              <LightningIcon className="h-2.5 w-2.5" />
            </span>
          </div>

          {/* Sender details */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">
                {transaction.sender.name}
              </span>
              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${assetStyle.badgeColor}`}>
                {assetStyle.schema}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-slate-300">
                da: {shortenIdentifier(transaction.sender.identifier, 14, 6)}
              </span>
              {transaction.memo && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate italic text-slate-400">{transaction.memo}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quanto e cosa arriva & Data */}
        <div className="flex items-center justify-between sm:flex-col sm:items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-emerald-400">+</span>
            <span className={`text-base font-bold tracking-tight sm:text-lg ${assetStyle.amountColor}`}>
              {formatAmount(transaction.amount, transaction.asset)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircleIcon className="h-3 w-3" />
              Incassato
            </span>
            <span className="text-slate-600">•</span>
            <span>{formatTimeAgo(transaction.timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Expanded Details: Technical specs when clicked */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-300 animate-fadeIn"
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <span className="text-slate-400">Identificativo Mittente:</span>
              <p className="mt-0.5 font-mono text-slate-200 break-all select-all">
                {transaction.sender.identifier}
              </p>
            </div>
            {transaction.channelId && (
              <div>
                <span className="text-slate-400">Canale Lightning:</span>
                <p className="mt-0.5 font-mono text-slate-200">{transaction.channelId}</p>
              </div>
            )}
            {transaction.paymentHash && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Payment Hash (Preimage Proof):</span>
                  <button
                    onClick={() => handleCopy(transaction.paymentHash!)}
                    className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                  >
                    {copied ? 'Copiato!' : 'Copia Hash'}
                  </button>
                </div>
                <p className="mt-0.5 font-mono text-slate-300 break-all select-all">
                  {transaction.paymentHash}
                </p>
              </div>
            )}
            <div className="text-slate-400">
              Data e ora completa:{' '}
              <span className="font-mono text-slate-300">
                {new Date(transaction.timestamp).toLocaleString('it-IT')}
              </span>
            </div>
            {transaction.memo && (
              <div className="text-slate-400">
                Causale:{' '}
                <span className="font-medium text-slate-200">{transaction.memo}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
