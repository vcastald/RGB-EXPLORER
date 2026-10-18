import { useState, useRef, useEffect } from 'react'

interface CreateXautInvoiceProps {
  onInvoiceCreated?: () => void
}

interface XautInvoiceResult {
  invoice: string
  recipientId?: string
  batchTransferIdx?: number
  expirationTimestamp?: number
  assetAmount?: number
  amountXaut?: string | null
  network?: string
  anyAsset?: boolean
  warning?: string
}

export function CreateXautInvoice({ onInvoiceCreated }: CreateXautInvoiceProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [amountXaut, setAmountXaut] = useState('0.01')
  const [allowAnyAsset, setAllowAnyAsset] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdInvoice, setCreatedInvoice] = useState<XautInvoiceResult | null>(null)
  const [copied, setCopied] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Quick preset amounts
  const presets = ['0.001', '0.01', '0.1', '1']

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

  const handleCreateInvoice = async (e?: React.FormEvent, forceAnyAsset = false) => {
    if (e) e.preventDefault()
    setError(null)

    const isAnyAsset = forceAnyAsset || allowAnyAsset
    const trimmed = amountXaut.trim()

    if (!isAnyAsset) {
      // Pattern: up to 4 digits before decimal, up to 9 decimals, or integer
      const pattern = /^(0|[1-9]\d{0,3})(\.\d{1,9})?$/
      if (!trimmed || !pattern.test(trimmed)) {
        setError('Enter a valid XAUT amount (e.g. 0.01 or 1, max 9 decimals)')
        return
      }
    }

    try {
      setLoading(true)
      const payload = isAnyAsset
        ? { allowAnyAsset: true }
        : { amountXaut: trimmed }

      const res = await fetch('/api/rgb/xaut/invoices', {
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

      const data = (await res.json()) as XautInvoiceResult
      setCreatedInvoice(data)
      onInvoiceCreated?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create XAUT invoice'
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
    setAmountXaut('0.01')
    setAllowAnyAsset(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button: "Create XAUT invoice" */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-300 transition-all cursor-pointer shadow-sm hover:border-amber-500/50"
        title="Create RGB on-chain XAUT (Tether Gold) Invoice"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-bold">
          Au
        </span>
        <span className="font-semibold">Create XAUT invoice</span>
        <svg
          className={`h-3.5 w-3.5 text-amber-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                Au
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Create RGB XAUT Invoice</h4>
                <p className="text-[10px] text-slate-400">Receive on-chain RGB-20 Tether Gold</p>
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
                {/* Amount input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-300">
                      Amount to receive (XAUT)
                    </label>
                    {allowAnyAsset && (
                      <span className="text-[10px] text-amber-400">Omitted in bootstrap mode</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={allowAnyAsset ? '' : amountXaut}
                      onChange={(e) => setAmountXaut(e.target.value)}
                      placeholder={allowAnyAsset ? 'Bootstrap: any amount accepted' : 'e.g. 0.01'}
                      disabled={loading || allowAnyAsset}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-2 pl-3 pr-16 text-xs text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 font-mono disabled:opacity-50"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-[11px] font-semibold text-amber-400">
                      XAUT
                    </span>
                  </div>
                </div>

                {/* Quick Presets */}
                {!allowAnyAsset && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Presets:</span>
                    {presets.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmountXaut(val)}
                        disabled={loading}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer ${
                          amountXaut === val
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/50'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}

                {/* Bootstrap Mode Checkbox (useful when wallet has never seen XAUT before) */}
                <div className="flex items-center gap-2 rounded-lg bg-slate-950/60 border border-slate-800/60 p-2">
                  <input
                    type="checkbox"
                    id="xaut-allow-any"
                    checked={allowAnyAsset}
                    onChange={(e) => setAllowAnyAsset(e.target.checked)}
                    disabled={loading}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/40 cursor-pointer"
                  />
                  <label htmlFor="xaut-allow-any" className="text-[10px] text-slate-300 cursor-pointer select-none">
                    <span className="font-semibold text-amber-300">Bootstrap invoice:</span> check if this wallet has not received XAUT before (accepts any asset)
                  </label>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-300 space-y-2">
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold">!</span>
                      <span>{error}</span>
                    </div>
                    {error.includes('not known') && (
                      <button
                        type="button"
                        onClick={() => {
                          setAllowAnyAsset(true)
                          handleCreateInvoice(undefined, true)
                        }}
                        className="w-full rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 py-1.5 px-2 text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        Create Bootstrap Invoice (Accepts Any Asset)
                      </button>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || (!allowAnyAsset && !amountXaut)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-3 text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-sm shadow-amber-500/20"
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
                    <span>{allowAnyAsset ? 'Create Bootstrap Invoice' : 'Create XAUT Invoice'}</span>
                  )}
                </button>
              </form>
            ) : (
              /* Success / Result Screen */
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-200">Invoice Ready</span>
                    <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300">
                      {createdInvoice.amountXaut
                        ? `+${createdInvoice.amountXaut} XAUT`
                        : 'Any RGB Asset (Bootstrap)'}
                    </span>
                  </div>
                  {createdInvoice.warning && (
                    <div className="mt-2 text-[10px] text-amber-400/90 border-t border-amber-500/20 pt-1.5 leading-relaxed">
                      ⚠️ {createdInvoice.warning}
                    </div>
                  )}
                </div>

                {/* Invoice Textbox with Copy button */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-slate-400">RGB Invoice:</span>
                    <button
                      onClick={() => handleCopy(createdInvoice.invoice)}
                      className="text-[10px] font-medium text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
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

                {/* Recipient ID if present */}
                {createdInvoice.recipientId && (
                  <div>
                    <span className="text-[10px] font-medium text-slate-400">Recipient ID:</span>
                    <div className="font-mono text-[10px] text-slate-400 truncate select-all">
                      {createdInvoice.recipientId}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(createdInvoice.invoice)}
                    className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 py-1.5 px-3 text-xs font-bold text-slate-950 transition-all cursor-pointer"
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
