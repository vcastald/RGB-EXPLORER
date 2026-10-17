import { useState } from 'react'
import { Transaction, AssetType, Denomination } from '../types/transaction'
import { AgentChat } from './AgentChat'
import { TransactionList } from './TransactionList'
import { AssetPieChart } from './AssetPieChart'
import { MarketQuotes } from './MarketQuotes'
import { useFrame } from '../hooks/useFrame'
import { LightningIcon } from './Icons'
import { shortenIdentifier } from '../utils/formatters'

interface DashboardProps {
  transactions: Transaction[]
  transactionsLoading?: boolean
  nodeOnline: boolean | null
  depositAddress?: string | null
  denomination: Denomination
  onDenominationChange: (val: Denomination) => void
}

export function Dashboard({
  transactions,
  transactionsLoading = false,
  nodeOnline,
  depositAddress,
  denomination,
  onDenominationChange,
}: DashboardProps) {
  const [selectedAsset, setSelectedAsset] = useState<'ALL' | AssetType>('ALL')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  const handleCopyAddress = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  // Polling quotes from Kaleido service every 5 minutes
  const {
    quotes,
    loading: quotesLoading,
    lastUpdated: quotesLastUpdated,
    refresh: refreshQuotes,
  } = useFrame(5 * 60 * 1000)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
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

      {/* Dashboard Headline & Actions */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

        {/* Right side of Headline: Deposit Address display + Denomination Dropdown PopUp */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {depositAddress && (
            <button
              onClick={handleCopyAddress}
              title="Clicca per copiare l'indirizzo di deposito completo"
              className="group flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 px-3 py-2 text-xs transition-all cursor-pointer shadow-sm hover:border-slate-700"
            >
              <span className="text-amber-400"><LightningIcon className="h-4 w-4" /></span>
              <span className="text-slate-400">Deposit Addr:</span>
              <span className="font-mono text-slate-200 group-hover:text-amber-400">
                {shortenIdentifier(depositAddress, 8, 6)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono group-hover:text-white">
                ({copiedAddress ? 'Copiato!' : 'Copia'})
              </span>
            </button>
          )}

          {/* Small Currency / Unit Dropdown PopUp */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition-all cursor-pointer shadow-sm hover:border-slate-700"
              title="Seleziona la valuta di stima per il controvalore"
            >
              <span className="text-slate-400">Valuta:</span>
              <span className={`font-bold flex items-center gap-1 ${denomination === 'USD' ? 'text-emerald-400' : 'text-orange-400'}`}>
                {denomination === 'USD' ? '$ USD' : '₿ BTC'}
              </span>
              <svg
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <>
                {/* Backdrop to close */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />

                {/* PopUp Menu */}
                <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md animate-fadeIn">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Controvalore in
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onDenominationChange('USD')
                      setDropdownOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                      denomination === 'USD'
                        ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold text-sm">$</span>
                      <span>Dollari (USD)</span>
                    </span>
                    {denomination === 'USD' && <span className="text-emerald-400 text-xs font-bold">✓</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDenominationChange('BTC')
                      setDropdownOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                      denomination === 'BTC'
                        ? 'bg-orange-500/15 text-orange-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-orange-400 font-bold text-sm">₿</span>
                      <span>Bitcoin (BTC)</span>
                    </span>
                    {denomination === 'BTC' && <span className="text-orange-400 text-xs font-bold">✓</span>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Central Section: 3 equal-height columns on desktop:
          Col 1: Agent Chat
          Col 2: Scrollable Transaction List
          Col 3: Asset Pie Chart + Kaleido Market Quotes
      */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 xl:gap-6 items-stretch">
        {/* Column 1: Agent Chat */}
        <div className="h-[600px] lg:h-[740px]">
          <AgentChat />
        </div>

        {/* Column 2: Transaction List */}
        <div className="h-[600px] lg:h-[740px]">
          <TransactionList
            transactions={transactions}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
            loading={transactionsLoading}
          />
        </div>

        {/* Column 3: Pie Chart + Market Quotes */}
        <div className="flex h-auto flex-col gap-4 lg:h-[740px]">
          <div className="min-h-[380px] lg:min-h-0 lg:flex-[1.15]">
            <AssetPieChart
              transactions={transactions}
              selectedAsset={selectedAsset}
              onSelectAsset={setSelectedAsset}
              denomination={denomination}
              loading={transactionsLoading}
              quotes={quotes}
            />
          </div>

          <div className="min-h-[320px] lg:min-h-0 lg:flex-1">
            <MarketQuotes
              quotes={quotes}
              loading={quotesLoading}
              lastUpdated={quotesLastUpdated}
              onRefresh={refreshQuotes}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
