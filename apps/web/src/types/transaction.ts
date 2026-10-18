export type AssetType = 'USDT' | 'XAUT' | 'BTC' | 'BTC_LN'

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
  txid?: string
  direction?: 'incoming' | 'outgoing'
  blockHeight?: number | null
  status: 'settled' | 'pending' | 'failed'
  memo?: string
  paymentType?: 'lightning' | 'onchain'
}

export interface ChannelLiquidity {
  totalCapacitySat: number
  localBalanceSat: number
  remoteBalanceSat: number
  localBalanceBtc: number
  capacityBtc: number
  channelsCount: number
}

export interface TargetAllocation {
  btc: number
  xaut: number
  usdt: number
}

