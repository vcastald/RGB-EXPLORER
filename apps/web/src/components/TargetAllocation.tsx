import { useState, useEffect } from 'react'
import { TargetAllocation as TargetAllocationType } from '../types/transaction'
import { TargetIcon } from './Icons'

interface TargetAllocationProps {
  target: TargetAllocationType
  onChangeTarget: (newTarget: TargetAllocationType) => Promise<boolean> | void
  loading?: boolean
}

export function TargetAllocation({ target, onChangeTarget, loading = false }: TargetAllocationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempTarget, setTempTarget] = useState<TargetAllocationType>(target)
  const [savedNotice, setSavedNotice] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Keep temporary target in sync whenever opened or external target updates
  useEffect(() => {
    setTempTarget(target)
  }, [target, isOpen])

  const total = tempTarget.btc + tempTarget.xaut + tempTarget.usdt
  const isBalanced = total === 100

  const handleInputChange = (asset: keyof TargetAllocationType, rawValue: string) => {
    const val = parseInt(rawValue, 10)
    const sanitized = isNaN(val) ? 0 : Math.max(0, Math.min(100, val))
    setTempTarget((prev) => ({
      ...prev,
      [asset]: sanitized,
    }))
  }

  const handleStep = (asset: keyof TargetAllocationType, delta: number) => {
    setTempTarget((prev) => {
      const current = prev[asset]
      const next = Math.max(0, Math.min(100, current + delta))
      return {
        ...prev,
        [asset]: next,
      }
    })
  }

  const handleAutoBalance = () => {
    const currentSum = tempTarget.btc + tempTarget.xaut + tempTarget.usdt
    if (currentSum === 0) {
      setTempTarget({ btc: 34, xaut: 33, usdt: 33 })
      return
    }
    const btcRatio = (tempTarget.btc / currentSum) * 100
    const xautRatio = (tempTarget.xaut / currentSum) * 100
    const btcNorm = Math.round(btcRatio)
    const xautNorm = Math.round(xautRatio)
    const usdtNorm = Math.max(0, 100 - btcNorm - xautNorm)
    setTempTarget({ btc: btcNorm, xaut: xautNorm, usdt: usdtNorm })
  }

  const applyPreset = (preset: TargetAllocationType) => {
    setTempTarget(preset)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setSaveError(null)
      const res = await onChangeTarget(tempTarget)
      if (res === false) {
        throw new Error('Error saving to database')
      }
      setSavedNotice(true)
      setTimeout(() => {
        setSavedNotice(false)
        setIsOpen(false)
      }, 500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setTempTarget(target)
    setSaveError(null)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      {/* Trigger Button displayed beside Deposit Address */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 px-3 py-2 text-xs transition-all cursor-pointer shadow-sm hover:border-slate-700"
        title="Set target allocation percentages for BTC, XAUT, and USDT"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 group-hover:text-indigo-300">
          <TargetIcon className="h-3 w-3" />
        </span>
        <span className="text-slate-400 font-medium">Target:</span>
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
          <span className="text-orange-400" title={`Target Bitcoin: ${target.btc}%`}>
            {target.btc}% <span className="text-[10px] font-sans font-normal text-slate-400">BTC</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-amber-300" title={`Target Tether Gold: ${target.xaut}%`}>
            {target.xaut}% <span className="text-[10px] font-sans font-normal text-slate-400">XAUT</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400" title={`Target Tether USD: ${target.usdt}%`}>
            {target.usdt}% <span className="text-[10px] font-sans font-normal text-slate-400">USDT</span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400 group-hover:text-amber-400 transition-colors ml-0.5">
          ({isOpen ? 'Close' : 'Edit'})
        </span>
      </button>

      {/* Popover Configuration Card */}
      {isOpen && (
        <>
          {/* Backdrop to close modal when clicking outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 z-50 w-[330px] sm:w-[380px] rounded-2xl border border-slate-800 bg-slate-900/98 p-4 shadow-2xl backdrop-blur-md animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                  <TargetIcon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-white sm:text-sm">
                      Treasury Target Allocation
                    </h4>
                    <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-mono text-indigo-400 border border-indigo-500/20">
                      params.sqlite
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Stored in local DB <code className="text-slate-300 font-mono">.local-app/params.sqlite</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Visual Multi-Asset Segmented Bar */}
            <div className="my-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Visual distribution:</span>
                <span className={`font-mono font-bold ${isBalanced ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {total}% {isBalanced ? '✓' : ''}
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                {tempTarget.btc > 0 && (
                  <div
                    style={{ width: `${(tempTarget.btc / Math.max(100, total)) * 100}%` }}
                    className="bg-orange-500 transition-all duration-200"
                    title={`Bitcoin: ${tempTarget.btc}%`}
                  />
                )}
                {tempTarget.xaut > 0 && (
                  <div
                    style={{ width: `${(tempTarget.xaut / Math.max(100, total)) * 100}%` }}
                    className="bg-amber-400 transition-all duration-200"
                    title={`Tether Gold: ${tempTarget.xaut}%`}
                  />
                )}
                {tempTarget.usdt > 0 && (
                  <div
                    style={{ width: `${(tempTarget.usdt / Math.max(100, total)) * 100}%` }}
                    className="bg-emerald-500 transition-all duration-200"
                    title={`Tether USD: ${tempTarget.usdt}%`}
                  />
                )}
              </div>
            </div>

            {/* Controls for each asset */}
            <div className="space-y-3 pt-1">
              {/* BTC Control */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 font-bold text-xs ring-1 ring-orange-500/30">
                      ₿
                    </span>
                    <span className="text-xs font-semibold text-slate-200">Bitcoin (BTC)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStep('btc', -5)}
                      className="h-6 w-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tempTarget.btc}
                        onChange={(e) => handleInputChange('btc', e.target.value)}
                        className="w-12 text-center rounded-md border border-slate-700 bg-slate-900 py-0.5 text-xs font-mono font-bold text-orange-400 focus:border-orange-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 absolute right-1.5 top-1 pointer-events-none">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStep('btc', 5)}
                      className="h-6 w-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={tempTarget.btc}
                  onChange={(e) => handleInputChange('btc', e.target.value)}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              {/* XAUT Control */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] ring-1 ring-amber-500/30">
                      Au
                    </span>
                    <span className="text-xs font-semibold text-slate-200">Tether Gold (XAUT)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStep('xaut', -5)}
                      className="h-6 w-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tempTarget.xaut}
                        onChange={(e) => handleInputChange('xaut', e.target.value)}
                        className="w-12 text-center rounded-md border border-slate-700 bg-slate-900 py-0.5 text-xs font-mono font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 absolute right-1.5 top-1 pointer-events-none">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStep('xaut', 5)}
                      className="h-6 w-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={tempTarget.xaut}
                  onChange={(e) => handleInputChange('xaut', e.target.value)}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* USDT Control */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs ring-1 ring-emerald-500/30">
                      ₮
                    </span>
                    <span className="text-xs font-semibold text-slate-200">Tether USD (USDT)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStep('usdt', -5)}
                      className="h-6 w-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tempTarget.usdt}
                        onChange={(e) => handleInputChange('usdt', e.target.value)}
                        className="w-12 text-center rounded-md border border-slate-700 bg-slate-900 py-0.5 text-xs font-mono font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 absolute right-1.5 top-1 pointer-events-none">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStep('usdt', 5)}
                      className="h-6 w-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={tempTarget.usdt}
                  onChange={(e) => handleInputChange('usdt', e.target.value)}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            {/* Validation Banner & Auto-Balance */}
            <div className="mt-3">
              {isBalanced ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold">✓</span> Balanced allocation (100%)
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  <div className="flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>
                      Total: <strong>{total}%</strong>{' '}
                      <span className="text-[10px] opacity-80">
                        ({total < 100 ? `-${100 - total}%` : `+${total - 100}%`})
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoBalance}
                    className="rounded-lg bg-amber-400/20 hover:bg-amber-400/30 px-2 py-0.5 text-[11px] font-bold text-amber-300 cursor-pointer transition-colors"
                  >
                    Balance to 100%
                  </button>
                </div>
              )}
            </div>

            {/* Quick Preset Buttons */}
            <div className="mt-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1.5">
                Quick presets:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => applyPreset({ btc: 40, xaut: 30, usdt: 30 })}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-slate-300 hover:border-amber-400/40 hover:text-white transition-all text-left cursor-pointer"
                >
                  <strong className="block text-white">40 / 30 / 30</strong>
                  <span className="text-[10px] text-slate-400">Balanced</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset({ btc: 60, xaut: 20, usdt: 20 })}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-slate-300 hover:border-amber-400/40 hover:text-white transition-all text-left cursor-pointer"
                >
                  <strong className="block text-white">60 / 20 / 20</strong>
                  <span className="text-[10px] text-slate-400">BTC Focus</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset({ btc: 34, xaut: 33, usdt: 33 })}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-slate-300 hover:border-amber-400/40 hover:text-white transition-all text-left cursor-pointer"
                >
                  <strong className="block text-white">34 / 33 / 33</strong>
                  <span className="text-[10px] text-slate-400">Equal Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset({ btc: 80, xaut: 10, usdt: 10 })}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-slate-300 hover:border-amber-400/40 hover:text-white transition-all text-left cursor-pointer"
                >
                  <strong className="block text-white">80 / 10 / 10</strong>
                  <span className="text-[10px] text-slate-400">BTC Maxi</span>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="min-w-0 flex-1 pr-2">
                {saveError && (
                  <span className="text-[11px] text-rose-400 font-medium truncate block">{saveError}</span>
                )}
                {loading && !saveError && (
                  <span className="text-[11px] text-slate-400 italic">Syncing DB…</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving}
                  className="rounded-xl px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 ${
                    savedNotice
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:from-amber-300 hover:to-orange-400'
                  }`}
                >
                  {isSaving ? 'Saving to DB…' : savedNotice ? '✓ Saved to DB!' : 'Save to DB'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
