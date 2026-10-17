import { useState } from 'react'
import { LightningIcon, SunIcon, MoonIcon } from './Icons'
import { shortenIdentifier } from '../utils/formatters'

interface HeaderProps {
  apiStatus?: string
  nodeOnline: boolean | null // null = checking
  depositAddress?: string | null
  onRefreshNode?: () => void
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
}

export function Header({
  apiStatus = 'Checking…',
  nodeOnline,
  depositAddress,
  onRefreshNode,
  theme = 'dark',
  onToggleTheme,
}: HeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyAddress = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-emerald-400 p-0.5 shadow-lg shadow-orange-500/10">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-amber-400">
              <LightningIcon className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                RGB<span className="text-amber-400">.</span>Explorer
              </h1>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                Lightning RGB
              </span>
            </div>
            <p className="text-xs text-slate-400">Business Treasury & Operations</p>
          </div>
        </div>

        {/* Network, Node Status, and Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Node Status Badge */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs">
            {nodeOnline === true ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="font-mono text-slate-400">Nodo:</span>
                <span className="font-semibold text-emerald-400">Online</span>

                {depositAddress && (
                  <button
                    onClick={handleCopyAddress}
                    title="Clicca per copiare il Deposit Address"
                    className="ml-1 cursor-pointer font-mono text-[11px] text-slate-400 hover:text-amber-400"
                  >
                    ({copied ? 'Copiato!' : shortenIdentifier(depositAddress, 5, 4)})
                  </button>
                )}
              </>
            ) : nodeOnline === false ? (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <span className="font-mono text-slate-400">Nodo:</span>
                <span className="font-semibold text-rose-400">Offline</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="font-mono text-slate-400">Nodo:</span>
                <span className="text-amber-400">Verifica…</span>
              </>
            )}

            {onRefreshNode && (
              <button
                onClick={onRefreshNode}
                title="Ricarica stato nodo"
                className="ml-1 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                ↻
              </button>
            )}
          </div>

          {/* API Backend Status */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-400">
            <span>API:</span>
            <strong
              className={
                apiStatus === 'Connected'
                  ? 'text-emerald-400'
                  : apiStatus === 'Checking…'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }
            >
              {apiStatus}
            </strong>
          </div>

          {/* Theme Toggle Button (White Mode / Dark Mode) */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Passa alla White Mode' : 'Passa alla Dark Mode'}
              className="relative flex items-center rounded-full border border-slate-800 bg-slate-950/80 p-0.5 text-xs transition-colors hover:border-slate-700 cursor-pointer shadow-sm"
            >
              <div
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-800 text-amber-300 font-semibold shadow-inner'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MoonIcon className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] hidden sm:inline">Dark</span>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-all ${
                  theme === 'light'
                    ? 'bg-amber-400/25 text-amber-600 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <SunIcon className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] hidden sm:inline">White</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

