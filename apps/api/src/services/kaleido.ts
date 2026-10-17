import { KaleidoClient } from 'kaleido-sdk'
import type { AddressStore } from '../storage/addresses.js'
import { SqliteAddressStore } from '../storage/addresses.js'

type Rln = ReturnType<typeof KaleidoClient.create>['rln']
type Maker = ReturnType<typeof KaleidoClient.create>['maker']

export interface NodeReader {
  getNodeInfo(): Promise<Pick<Awaited<ReturnType<Rln['getNodeInfo']>>, 'pubkey'>>
  getNetworkInfo(): ReturnType<Rln['getNetworkInfo']>
  getAddress(): ReturnType<Rln['getAddress']>
  getBtcBalance(skipSync?: boolean): ReturnType<Rln['getBtcBalance']>
  listAssets(): ReturnType<Rln['listAssets']>
  listChannels(): ReturnType<Rln['listChannels']>
  listTransactions(): ReturnType<Rln['listTransactions']>
  listPayments(): ReturnType<Rln['listPayments']>
  listTransfers?(body?: Parameters<Rln['listTransfers']>[0]): ReturnType<Rln['listTransfers']>
}

export interface NodeRgbTransfer {
  id: string
  idx: number
  txid: string | null
  timestamp: string
  asset: 'USDT' | 'XAUT' | 'BTC' | string
  amount: number
  unit: string
  direction: 'incoming' | 'outgoing'
  status: 'settled' | 'pending' | 'failed'
  kind: string
  recipientId: string | null
  receiveUtxo: string | null
  changeUtxo: string | null
  sender: {
    name: string
    identifier: string
    type: 'node' | 'business' | 'individual' | 'exchange'
  }
  memo: string
  paymentType: 'onchain'
  assetId: string | null
}

export interface TransfersResponse {
  observedAt: string
  transfers: NodeRgbTransfer[]
}

export interface MarketReader {
  listPairs(): ReturnType<Maker['listPairs']>
}

export interface MarketQuote {
  pair: string
  baseTicker: string
  quoteTicker: string
  price: number
  formattedPrice: string
  inversePrice?: number
  inverseFormatted?: string
  updatedAt: string
}

export interface QuotesResponse {
  observedAt: string
  quotes: MarketQuote[]
}

export interface NodeBtcTransaction {
  id: string
  txid: string
  timestamp: string
  asset: 'BTC'
  amount: number
  unit: string
  receivedSats: number
  sentSats: number
  feeSats: number
  direction: 'incoming' | 'outgoing'
  status: 'settled' | 'pending'
  blockHeight: number | null
  transactionType: string
  sender: {
    name: string
    identifier: string
    type: 'node'
  }
  memo: string
  paymentType?: 'onchain'
}

export interface NodeLightningPayment {
  id: string
  paymentHash: string
  timestamp: string
  asset: 'BTC' | string
  amount: number
  unit: string
  amtMsat: number | null
  assetAmount: number | null
  assetId: string | null
  direction: 'incoming' | 'outgoing'
  status: 'settled' | 'pending' | 'failed'
  payeePubkey: string
  preimage?: string | null
  description: string
  sender: {
    name: string
    identifier: string
    type: 'node'
  }
  memo: string
  paymentType: 'lightning'
}

export interface NodeChannelLiquidity {
  totalCapacitySat: number
  localBalanceSat: number
  remoteBalanceSat: number
  localBalanceBtc: number
  capacityBtc: number
  channelsCount: number
}

export interface PaymentsResponse {
  observedAt: string
  payments: NodeLightningPayment[]
  channelLiquidity: NodeChannelLiquidity
}

export class KaleidoService {
  private readonly market?: MarketReader | null
  private readonly now: () => Date

  constructor(
    private readonly node: NodeReader,
    private readonly addresses: AddressStore,
    marketOrNow?: MarketReader | null | (() => Date),
    now?: () => Date,
  ) {
    if (typeof marketOrNow === 'function') {
      this.market = null
      this.now = marketOrNow
    } else {
      this.market = marketOrNow ?? null
      this.now = now ?? (() => new Date())
    }
  }

  async createDepositAddress() {
    const network = await this.node.getNetworkInfo()
    if (network.network !== 'SignetCustom') throw new Error('Deposit addresses require a Mutinynet node')
    const { pubkey } = await this.node.getNodeInfo()
    const { address } = await this.node.getAddress()
    const record = { address, network: network.network, nodePubkey: pubkey, createdAt: this.now().toISOString() }
    this.addresses.save(record)
    return record
  }

  async listDepositAddresses() {
    const [network, info] = await Promise.all([this.node.getNetworkInfo(), this.node.getNodeInfo()])
    return this.addresses.list(info.pubkey, network.network)
  }

  async getOverview() {
    // Cached balance avoids triggering a wallet sync during an overview request.
    const [info, network, btc, assets, channels] = await Promise.all([
      this.node.getNodeInfo(),
      this.node.getNetworkInfo(),
      this.node.getBtcBalance(true),
      this.node.listAssets(),
      this.node.listChannels(),
    ])

    return {
      observedAt: this.now().toISOString(),
      network: network.network,
      height: network.height,
      pubkey: info.pubkey,
      btc: { ...btc, cached: true },
      assets: Object.entries(assets).flatMap(([schema, entries]) =>
        (entries ?? []).map((asset) =>
          ({ schema, assetId: asset.asset_id, ticker: 'ticker' in asset ? asset.ticker : null,
            name: asset.name, precision: asset.precision, balance: asset.balance }))),
      channels: channels.channels.map((channel) => ({
        channelId: channel.channel_id,
        peerPubkey: channel.peer_pubkey,
        status: channel.status,
        usable: channel.is_usable,
        capacitySat: channel.capacity_sat,
        localBalanceSat: channel.local_balance_sat,
        assetId: channel.asset_id ?? null,
      })),
    }
  }

  async listTransactions(): Promise<{ observedAt: string; transactions: NodeBtcTransaction[] }> {
    const res = await this.node.listTransactions()
    const transactions: NodeBtcTransaction[] = (res.transactions ?? []).map((tx) => {
      const netSats = tx.received - tx.sent
      const isIncoming = netSats >= 0
      const amount = Math.abs(netSats) / 100_000_000
      const timestamp = tx.confirmation_time
        ? new Date(tx.confirmation_time.timestamp * 1000).toISOString()
        : this.now().toISOString()

      return {
        id: tx.txid,
        txid: tx.txid,
        timestamp,
        asset: 'BTC' as const,
        amount,
        unit: 'BTC',
        receivedSats: tx.received,
        sentSats: tx.sent,
        feeSats: tx.fee,
        direction: isIncoming ? 'incoming' : 'outgoing',
        status: tx.confirmation_time ? 'settled' : 'pending',
        blockHeight: tx.confirmation_time?.height ?? null,
        transactionType: tx.transaction_type,
        sender: {
          name: isIncoming ? 'Bitcoin On-Chain Deposit' : 'Bitcoin On-Chain Transfer',
          identifier: tx.txid,
          type: 'node' as const,
        },
        memo: `On-chain ${tx.transaction_type}`,
        paymentType: 'onchain' as const,
      }
    })

    return {
      observedAt: this.now().toISOString(),
      transactions,
    }
  }

  async listPayments(): Promise<PaymentsResponse> {
    const [paymentsRes, channelsRes] = await Promise.all([
      this.node.listPayments(),
      this.node.listChannels().catch(() => ({ channels: [] })),
    ])

    const payments: NodeLightningPayment[] = (paymentsRes.payments ?? []).map((p) => {
      // Millisatoshis: 1 BTC = 100_000_000_000 msat (1 sat = 1000 msat)
      const btcAmount = p.amt_msat != null ? p.amt_msat / 100_000_000_000 : 0
      const isIncoming = Boolean(p.inbound)
      const timestamp = p.created_at
        ? new Date(p.created_at * 1000).toISOString()
        : this.now().toISOString()

      const asset = p.asset_id ? 'RGB' : 'BTC'
      const amount = p.asset_id && p.asset_amount != null ? p.asset_amount : btcAmount
      const unit = p.asset_id ? 'RGB' : 'BTC'

      return {
        id: p.payment_hash,
        paymentHash: p.payment_hash,
        timestamp,
        asset,
        amount,
        unit,
        amtMsat: p.amt_msat ?? null,
        assetAmount: p.asset_amount ?? null,
        assetId: p.asset_id ?? null,
        direction: isIncoming ? 'incoming' : 'outgoing',
        status: p.status === 'Succeeded' ? 'settled' : p.status === 'Failed' ? 'failed' : 'pending',
        payeePubkey: p.payee_pubkey,
        preimage: p.preimage ?? null,
        description: p.description ?? '',
        sender: {
          name: isIncoming ? 'Lightning Payment Received' : 'Lightning Payment Sent',
          identifier: p.payee_pubkey || p.payment_hash,
          type: 'node' as const,
        },
        memo: p.description || (isIncoming ? 'Lightning payment received' : 'Lightning payment sent'),
        paymentType: 'lightning' as const,
      }
    })

    const channels = channelsRes?.channels ?? []
    // Filter strictly to native Bitcoin Lightning channels (excluding RGB asset channels)
    const btcChannels = channels.filter((ch) => !ch.asset_id)
    const totalCapacitySat = btcChannels.reduce((sum, ch) => sum + (ch.capacity_sat ?? 0), 0)
    const localBalanceSat = btcChannels.reduce((sum, ch) => sum + (ch.local_balance_sat ?? 0), 0)
    const remoteBalanceSat = Math.max(0, totalCapacitySat - localBalanceSat)

    const channelLiquidity: NodeChannelLiquidity = {
      totalCapacitySat,
      localBalanceSat,
      remoteBalanceSat,
      localBalanceBtc: localBalanceSat / 100_000_000,
      capacityBtc: totalCapacitySat / 100_000_000,
      channelsCount: btcChannels.length,
    }

    return {
      observedAt: this.now().toISOString(),
      payments,
      channelLiquidity,
    }
  }

  async listTransfers(): Promise<TransfersResponse> {
    if (!this.node.listTransfers) {
      return { observedAt: this.now().toISOString(), transfers: [] }
    }

    // 1. Fetch assets to map asset_id -> ticker and precision
    const assetsRes = await this.node.listAssets().catch(() => ({ nia: [], uda: [], cfa: [], ifa: [] }))
    const allAssets = [
      ...(assetsRes?.nia ?? []),
      ...(assetsRes?.cfa ?? []),
      ...(assetsRes?.uda ?? []),
      ...(assetsRes?.ifa ?? []),
    ]

    const assetMap = new Map<string, { ticker: string; name: string; precision: number }>()
    for (const a of allAssets) {
      if (a?.asset_id) {
        const rawTicker = ('ticker' in a && typeof a.ticker === 'string' && a.ticker ? a.ticker : 'RGB').toUpperCase()
        const ticker = rawTicker.includes('USDT') ? 'USDT' : rawTicker.includes('XAUT') || rawTicker.includes('GOLD') ? 'XAUT' : rawTicker
        assetMap.set(a.asset_id, {
          ticker,
          name: a.name || ticker,
          precision: typeof a.precision === 'number' ? a.precision : 0,
        })
      }
    }

    // 2. Query transfers: by asset filter for each known asset, and general filter
    type RawTransferEntry = {
      transfer: any
      assetId: string | null
    }
    const rawEntries: RawTransferEntry[] = []

    if (allAssets.length > 0) {
      const perAssetTransfers = await Promise.all(
        allAssets.map(async (asset) => {
          try {
            const res = await this.node.listTransfers!({ asset_filter: { type: 'Id', value: asset.asset_id } as any })
            return (res.transfers ?? []).map((t) => ({ transfer: t, assetId: asset.asset_id }))
          } catch {
            return []
          }
        })
      )
      for (const list of perAssetTransfers) {
        rawEntries.push(...list)
      }
    }

    try {
      const generalRes = await this.node.listTransfers({ asset_filter: { type: 'None' } as any })
      if (generalRes && Array.isArray(generalRes.transfers)) {
        for (const t of generalRes.transfers) {
          if (!rawEntries.some((e) => e.transfer.idx === t.idx)) {
            rawEntries.push({ transfer: t, assetId: null })
          }
        }
      }
    } catch {
      // Ignore if { type: 'None' } is unsupported or returns error
    }

    // 3. Normalize into NodeRgbTransfer
    const transfers: NodeRgbTransfer[] = rawEntries.map(({ transfer: t, assetId }) => {
      const assetInfo = assetId ? assetMap.get(assetId) : null
      let assetTicker = assetInfo?.ticker ?? 'USDT'
      if (assetTicker.includes('USDT')) assetTicker = 'USDT'
      else if (assetTicker.includes('XAUT') || assetTicker.includes('GOLD')) assetTicker = 'XAUT'

      const isOutgoing = t.kind === 'Send' || t.kind === 'Burn'
      const direction: 'incoming' | 'outgoing' = isOutgoing ? 'outgoing' : 'incoming'

      let rawAmount = 0
      if (Array.isArray(t.assignments) && t.assignments.length > 0) {
        rawAmount = t.assignments.reduce((sum: number, a: any) => {
          return a && typeof a.value === 'number' ? sum + a.value : sum
        }, 0)
      } else if (t.requested_assignment && typeof (t.requested_assignment as any).value === 'number') {
        rawAmount = (t.requested_assignment as any).value
      }

      const precision = assetInfo?.precision ?? (assetTicker === 'USDT' ? 2 : assetTicker === 'XAUT' ? 4 : 0)
      const amount = precision > 0 ? rawAmount / 10 ** precision : rawAmount

      const status: 'settled' | 'pending' | 'failed' =
        t.status === 'Settled'
          ? 'settled'
          : t.status === 'Failed'
          ? 'failed'
          : 'pending'

      const timestamp = t.created_at
        ? new Date(t.created_at * 1000).toISOString()
        : this.now().toISOString()

      const id = t.txid ? `${t.txid}:${t.idx}` : `rgb-transfer-${t.idx}`

      return {
        id,
        idx: t.idx,
        txid: t.txid ?? null,
        timestamp,
        asset: assetTicker,
        amount,
        unit: assetTicker,
        direction,
        status,
        kind: t.kind || 'Transfer',
        recipientId: t.recipient_id ?? null,
        receiveUtxo: t.receive_utxo ?? null,
        changeUtxo: t.change_utxo ?? null,
        sender: {
          name: isOutgoing ? `RGB On-Chain ${assetTicker} Transfer` : `RGB On-Chain ${assetTicker} Deposit`,
          identifier: t.txid || t.recipient_id || `transfer-${t.idx}`,
          type: 'node' as const,
        },
        memo: `On-chain RGB ${assetTicker} transfer (${t.kind || 'Transfer'})`,
        paymentType: 'onchain' as const,
        assetId: assetId ?? null,
      }
    })

    return {
      observedAt: this.now().toISOString(),
      transfers,
    }
  }

  async getQuotes(): Promise<QuotesResponse> {
    if (!this.market) {
      throw new Error('Market service not configured')
    }

    const { pairs } = await this.market.listPairs()
    const quotes: MarketQuote[] = []
    const nowIso = this.now().toISOString()

    // 1. BTC/USDT
    const btcUsdt = (pairs ?? []).find((p) => p.ticker === 'BTC/USDT')
    if (btcUsdt) {
      const price = Number(btcUsdt.price) / 10 ** btcUsdt.quote.precision
      quotes.push({
        pair: 'BTC/USDT',
        baseTicker: 'BTC',
        quoteTicker: 'USDT',
        price,
        formattedPrice: `${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
        updatedAt: nowIso,
      })
    }

    // 2. BTC/XAUT
    const btcXaut = (pairs ?? []).find((p) => p.ticker === 'BTC/XAUT')
    if (btcXaut) {
      const price = Number(btcXaut.price) / 10 ** btcXaut.quote.precision
      quotes.push({
        pair: 'BTC/XAUT',
        baseTicker: 'BTC',
        quoteTicker: 'XAUT',
        price,
        formattedPrice: `${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} XAUT`,
        updatedAt: nowIso,
      })
    }

    // 3. USDT/XAUT (calculated from market pair XAUT/USDT)
    const xautUsdt = (pairs ?? []).find((p) => p.ticker === 'XAUT/USDT')
    if (xautUsdt) {
      const xautPriceInUsdt = Number(xautUsdt.price) / 10 ** xautUsdt.quote.precision
      const usdtPriceInXaut = xautPriceInUsdt > 0 ? 1 / xautPriceInUsdt : 0
      quotes.push({
        pair: 'USDT/XAUT',
        baseTicker: 'USDT',
        quoteTicker: 'XAUT',
        price: usdtPriceInXaut,
        formattedPrice: `${usdtPriceInXaut.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 })} XAUT`,
        inversePrice: xautPriceInUsdt,
        inverseFormatted: `${xautPriceInUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
        updatedAt: nowIso,
      })
    }

    return {
      observedAt: nowIso,
      quotes,
    }
  }
}

export type WalletService = Pick<
  KaleidoService,
  'getOverview' | 'createDepositAddress' | 'listDepositAddresses' | 'getQuotes' | 'listTransactions' | 'listPayments' | 'listTransfers'
>

export type OverviewService = WalletService

export function createKaleidoService(
  nodeUrl: string,
  dbPath: string,
  baseUrl = process.env.KALEIDO_API_URL ?? 'https://api.signet.kaleidoswap.com',
): WalletService & { close(): Promise<void> } {
  const addresses = new SqliteAddressStore(dbPath)
  const client = KaleidoClient.create({ nodeUrl, baseUrl, timeout: 30 })
  const service = new KaleidoService(client.rln, addresses, client.maker)
  return {
    getOverview: () => service.getOverview(),
    createDepositAddress: () => service.createDepositAddress(),
    listDepositAddresses: () => service.listDepositAddresses(),
    getQuotes: () => service.getQuotes(),
    listTransactions: () => service.listTransactions(),
    listPayments: () => service.listPayments(),
    listTransfers: () => service.listTransfers(),
    close: async () => {
      await client.close()
      addresses.close()
    },
  }
}
