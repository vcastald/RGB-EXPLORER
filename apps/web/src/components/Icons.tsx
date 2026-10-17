import React from 'react'

export function LightningIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

export function ArrowDownLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 5L5 19m0 0h10m-10 0V9" />
    </svg>
  )
}

export function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

export function CheckCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export function AssetBadgeIcon({ asset, className = 'w-5 h-5' }: { asset: 'USDT' | 'XAUT' | 'BTC'; className?: string }) {
  if (asset === 'USDT') {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs ring-1 ring-emerald-500/30 ${className}`}>
        ₮
      </span>
    )
  }
  if (asset === 'XAUT') {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs ring-1 ring-amber-500/30 ${className}`}>
        Au
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-full bg-orange-500/20 text-orange-400 font-bold text-xs ring-1 ring-orange-500/30 ${className}`}>
      ₿
    </span>
  )
}

export function SunIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  )
}

export function MoonIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  )
}
