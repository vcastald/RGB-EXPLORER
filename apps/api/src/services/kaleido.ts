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
        formattedPrice: `${price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
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
        formattedPrice: `${price.toLocaleString('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} XAUT`,
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
        formattedPrice: `${usdtPriceInXaut.toLocaleString('it-IT', { minimumFractionDigits: 6, maximumFractionDigits: 8 })} XAUT`,
        inversePrice: xautPriceInUsdt,
        inverseFormatted: `${xautPriceInUsdt.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
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
  'getOverview' | 'createDepositAddress' | 'listDepositAddresses' | 'getQuotes' | 'listTransactions' | 'listPayments'
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
    close: async () => {
      await client.close()
      addresses.close()
    },
  }
}
