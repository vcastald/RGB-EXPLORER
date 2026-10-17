import { AssetType } from '../types/transaction'

export function formatAmount(amount: number, asset: AssetType): string {
  switch (asset) {
    case 'USDT':
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount) + ' USDT'
    case 'XAUT':
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 4,
      }).format(amount) + ' XAUT'
    case 'BTC':
    case 'BTC_LN':
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 8,
        maximumFractionDigits: 8,
      }).format(amount) + ' BTC'
  }
}

export function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function shortenIdentifier(id: string, start = 6, end = 4): string {
  if (id.length <= start + end + 3) return id
  return `${id.slice(0, start)}...${id.slice(-end)}`
}
