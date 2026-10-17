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

  const isLightning =
    transaction.paymentType === 'lightning' ||
    transaction.asset === 'BTC_LN' ||
    Boolean(transaction.paymentHash) ||
    Boolean(transaction.channelId)

  const getAssetBadge = () => {
    switch (transaction.asset) {
      case 'USDT':
        return {
          label: 'USDT',
          schema: 'RGB20 (LN)',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          amountColor: 'text-emerald-400',
        }
      case 'XAUT':
        return {
          label: 'XAUT',
          schema: 'RGB20 (LN)',
          badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          amountColor: 'text-amber-300',
        }
      case 'BTC_LN':
        return {
          label: 'BTC',
          schema: '⚡ LN PAYMENT',
          badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          amountColor: 'text-indigo-300',
        }
      case 'BTC':
      default:
        if (isLightning) {
          return {
            label: 'BTC',
            schema: '⚡ LN PAYMENT',
            badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
            amountColor: 'text-indigo-300',
          }
        }
        return {
          label: 'BTC',
          schema: '⛓️ ON-CHAIN',
          badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          amountColor: 'text-orange-400',
        }
    }
  }

  const assetStyle = getAssetBadge()

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="group cursor-pointer border-b border-slate-800/70 bg-slate-900/30 px-3.5 py-3 transition-all duration-150 hover:bg-slate-800/50"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Icon & Sender */}
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Asset Icon */}
          <div className="relative flex-shrink-0">
            {isLightning && (transaction.asset === 'BTC' || transaction.asset === 'BTC_LN') ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 text-amber-400 ring-1 ring-amber-400/30">
                <LightningIcon className="h-4 w-4" />
              </div>
            ) : (
              <AssetBadgeIcon asset={transaction.asset} className="h-8 w-8 text-xs" />
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-950 ring-1 ring-slate-900 ${
                isLightning ? 'text-amber-400' : 'text-orange-400'
              }`}
              title={isLightning ? 'Pagamento Canale Lightning' : 'Transazione Bitcoin On-Chain'}
            >
              {isLightning ? <LightningIcon className="h-2 w-2" /> : <span className="text-[8px] font-bold">₿</span>}
            </span>
          </div>

          {/* Sender details */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-semibold text-slate-100 group-hover:text-white">
                {transaction.sender.name}
              </span>
              <span
                className={`inline-flex items-center rounded px-1 py-0.2 text-[9px] font-semibold border ${assetStyle.badgeColor}`}
              >
                {assetStyle.schema}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
              <span className="font-mono text-slate-400">
                da: {shortenIdentifier(transaction.sender.identifier, 8, 4)}
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

        {/* Right: Amount & Status */}
        <div className="flex flex-shrink-0 flex-col items-end">
          <div className={`text-xs font-bold tracking-tight sm:text-sm ${assetStyle.amountColor}`}>
            {transaction.direction === 'outgoing' ? '- ' : '+ '}{formatAmount(transaction.amount, transaction.asset)}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                transaction.status === 'settled' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              <CheckCircleIcon className="h-2.5 w-2.5" />
            </span>
            <span>{formatTimeAgo(transaction.timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2.5 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-[11px] text-slate-300 animate-fadeIn"
        >
          <div className="space-y-1.5">
            <div>
              <span className="text-slate-400">Mittente / ID: </span>
              <span className="font-mono text-slate-200 select-all break-all">
                {transaction.sender.identifier}
              </span>
            </div>
            {transaction.txid && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">TXID On-Chain:</span>
                  <button
                    onClick={() => handleCopy(transaction.txid!)}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    {copied ? 'Copiato!' : 'Copia'}
                  </button>
                </div>
                <p className="font-mono text-slate-300 break-all select-all text-[10px]">
                  {transaction.txid}
                </p>
              </div>
            )}
            {transaction.blockHeight && (
              <div>
                <span className="text-slate-400">Altezza Blocco: </span>
                <span className="font-mono text-slate-200">#{transaction.blockHeight}</span>
              </div>
            )}
            {transaction.channelId && (
              <div>
                <span className="text-slate-400">Canale: </span>
                <span className="font-mono text-slate-200">{transaction.channelId}</span>
              </div>
            )}
            {transaction.paymentHash && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">⚡ Payment Hash (LN):</span>
                  <button
                    onClick={() => handleCopy(transaction.paymentHash!)}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    {copied ? 'Copiato!' : 'Copia'}
                  </button>
                </div>
                <p className="font-mono text-slate-300 break-all select-all text-[10px]">
                  {transaction.paymentHash}
                </p>
              </div>
            )}
            <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
              <span>{new Date(transaction.timestamp).toLocaleString('it-IT')}</span>
              {transaction.memo && <span className="italic text-slate-300">{transaction.memo}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
