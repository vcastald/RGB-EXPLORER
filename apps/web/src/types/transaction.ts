export type AssetType = 'USDT' | 'XAUT' | 'BTC'

export type Denomination = 'USD' | 'BTC'

export interface TransactionSender {
  name: string
  identifier: string // node pubkey, alias, or lightning address
  type?: 'node' | 'business' | 'individual' | 'exchange'
}

export interface Transaction {
  id: string
  timestamp: string // ISO string
  asset: AssetType
  amount: number
  unit: string
  sender: TransactionSender
  channelId?: string
  paymentHash?: string
  status: 'settled' | 'pending'
  memo?: string
}
