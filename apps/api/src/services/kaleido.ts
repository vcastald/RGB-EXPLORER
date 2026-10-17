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
  'getOverview' | 'createDepositAddress' | 'listDepositAddresses' | 'getQuotes'
>

export type OverviewService = WalletService

export function createKaleidoService(
  nodeUrl: string,
  dbPath: string,
  baseUrl = process.env.KALEIDO_API_URL ?? 'https://api.signet.kaleidoswap.com',
): WalletService & { close(): Promise<void> } {
  const addresses = new SqliteAddressStore(dbPath)
  const client = KaleidoClient.create({ nodeUrl, baseUrl, timeout: 5 })
  const service = new KaleidoService(client.rln, addresses, client.maker)
  return {
    getOverview: () => service.getOverview(),
    createDepositAddress: () => service.createDepositAddress(),
    listDepositAddresses: () => service.listDepositAddresses(),
    getQuotes: () => service.getQuotes(),
    close: async () => {
      await client.close()
      addresses.close()
    },
  }
}
