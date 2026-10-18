import { useState, useRef, useEffect } from 'react'

interface CreateLightningInvoiceProps {
  onInvoiceCreated?: () => void
}

interface LightningInvoiceResult {
  invoice: string
  amountSat: number
  expirySec: number
}

export function CreateLightningInvoice({ onInvoiceCreated }: CreateLightningInvoiceProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [amountSat, setAmountSat] = useState('1000')
  const [description, setDescription] = useState('Treasury deposit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdInvoice, setCreatedInvoice] = useState<LightningInvoiceResult | null>(null)
  const [copied, setCopied] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Quick preset amounts in sats
  const presets = ['100', '500', '1000', '5000', '10000']

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleCreateInvoice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)

    const trimmedAmount = amountSat.trim()
    const parsedAmount = Number(trimmedAmount)

    if (!trimmedAmount || !Number.isInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 40000) {
      setError('Enter a valid integer amount between 1 and 40,000 sats')
      return
    }

    const trimmedDesc = description.trim()
    if (trimmedDesc.length > 200) {
      setError('Description must not exceed 200 characters')
      return
    }

    try {
      setLoading(true)
      const payload: { amountSat: number; description?: string } = {
        amountSat: parsedAmount,
      }
      if (trimmedDesc) {
        payload.description = trimmedDesc
      }

      const res = await fetch('/api/lightning/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errorData.error || `HTTP Error ${res.status}`)
      }

      const data = (await res.json()) as LightningInvoiceResult
      setCreatedInvoice(data)
      onInvoiceCreated?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create Lightning invoice'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleReset = () => {
    setCreatedInvoice(null)
    setError(null)
    setAmountSat('1000')
    setDescription('Treasury deposit')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button: "Create Lightning invoice" */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 px-3 py-2 text-xs font-medium text-yellow-300 transition-all cursor-pointer shadow-sm hover:border-yellow-500/50"
        title="Create BTC Lightning Invoice"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500/30 text-yellow-300 text-[10px] font-bold">
          ⚡
        </span>
        <span className="font-semibold">Create Lightning invoice</span>
        <svg
          className={`h-3.5 w-3.5 text-yellow-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu / Form */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-84 sm:w-96 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                ⚡
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Create BTC Lightning Invoice</h4>
                <p className="text-[10px] text-slate-400">Receive instant Lightning BTC</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="mt-3">
            {!createdInvoice ? (
              <form onSubmit={handleCreateInvoice} className="space-y-3">
                {/* Channel requirement notice */}
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-2.5 text-[11px] text-yellow-200">
                  <div className="flex items-start gap-2">
                    <span className="text-sm leading-none shrink-0">⚠️</span>
                    <div className="space-y-1">
                      <span className="font-semibold block text-yellow-300">
                        Lightning Channel Required
                      </span>
                      <p className="text-[10px] text-yellow-200/90 leading-relaxed">
                        Make sure you have purchased or opened a Lightning channel with inbound liquidity.
                        If you haven&apos;t done so yet, follow the instructions in the <strong>README.md</strong> (e.g. <code>npm run usdt:setup</code> or the LSP guide).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Amount input in sats */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Amount to receive (sats)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={40000}
                      step={1}
                      value={amountSat}
                      onChange={(e) => setAmountSat(e.target.value)}
                      placeholder="e.g. 1000"
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-2 pl-3 pr-16 text-xs text-white placeholder-slate-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 font-mono"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-[11px] font-semibold text-yellow-400">
                      sats
                    </span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400">Presets:</span>
                  {presets.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmountSat(val)}
                      disabled={loading}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer ${
                        amountSat === val
                          ? 'bg-yellow-500/25 text-yellow-300 border border-yellow-500/40 font-bold'
                          : 'bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/50'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>

                {/* Description input */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Description <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Treasury deposit"
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                  />
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-300 space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold">!</span>
                      <span>{error}</span>
                    </div>
                    {error.toLowerCase().includes('liquidity') && (
                      <p className="text-[10px] text-yellow-300/90 border-t border-rose-500/20 pt-1 leading-relaxed">
                        💡 Not enough inbound liquidity on the channel. Open or expand a channel by following the instructions in <strong>README.md</strong>.
                      </p>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !amountSat}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-3 text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-sm shadow-yellow-500/20"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-slate-950" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Creating Invoice…</span>
                    </>
                  ) : (
                    <span>Create Lightning Invoice</span>
                  )}
                </button>
              </form>
            ) : (
              /* Success / Result Screen */
              <div className="space-y-3">
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-2.5 text-xs text-yellow-300">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-yellow-200">Lightning Invoice Ready</span>
                    <span className="text-[10px] font-mono bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-300">
                      +{createdInvoice.amountSat.toLocaleString()} sats
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-yellow-400/80">
                    Expires in {Math.round(createdInvoice.expirySec / 60)} minutes
                  </div>
                </div>

                {/* Invoice Textbox with Copy button */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-slate-400">BOLT11 Invoice:</span>
                    <button
                      onClick={() => handleCopy(createdInvoice.invoice)}
                      className="text-[10px] font-medium text-yellow-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      {copied ? '✓ Copied!' : 'Copy Invoice'}
                    </button>
                  </div>
                  <div
                    onClick={() => handleCopy(createdInvoice.invoice)}
                    className="p-2 rounded-lg border border-slate-800 bg-slate-950 font-mono text-[10px] text-slate-300 break-all select-all max-h-24 overflow-y-auto cursor-pointer hover:border-slate-700"
                    title="Click to copy invoice"
                  >
                    {createdInvoice.invoice}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(createdInvoice.invoice)}
                    className="flex-1 rounded-xl bg-yellow-500 hover:bg-yellow-400 py-1.5 px-3 text-xs font-bold text-slate-950 transition-all cursor-pointer"
                  >
                    {copied ? 'Copied to Clipboard' : 'Copy Invoice'}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-700/80 py-1.5 px-3 text-xs font-medium text-slate-300 transition-all cursor-pointer"
                  >
                    New
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
