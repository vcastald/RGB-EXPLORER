import { useState } from 'react'
import { LightningIcon } from './Icons'
import { shortenIdentifier } from '../utils/formatters'

interface HeaderProps {
  apiStatus?: string
  nodeOnline: boolean | null // null = checking
  nodePubkey?: string
  onRefreshNode?: () => void
}

export function Header({
  apiStatus = 'Checking…',
  nodeOnline,
  nodePubkey,
  onRefreshNode,
}: HeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyPubkey = () => {
    if (nodePubkey) {
      navigator.clipboard.writeText(nodePubkey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
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

        {/* Network & Node Status */}
        <div className="flex items-center gap-2.5 sm:gap-3">
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

                {nodePubkey && (
                  <button
                    onClick={handleCopyPubkey}
                    title="Clicca per copiare la Public Key completa del nodo"
                    className="ml-1 cursor-pointer font-mono text-[11px] text-slate-400 hover:text-amber-400"
                  >
                    ({copied ? 'Copiata!' : shortenIdentifier(nodePubkey, 4, 4)})
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
        </div>
      </div>
    </header>
  )
}
