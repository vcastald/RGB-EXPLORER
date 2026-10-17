import { KaleidoClient } from 'kaleido-sdk'
import type { AddressStore } from '../storage/addresses.js'
import { SqliteAddressStore } from '../storage/addresses.js'

type Rln = ReturnType<typeof KaleidoClient.create>['rln']

export interface NodeReader {
  getNodeInfo(): Promise<Pick<Awaited<ReturnType<Rln['getNodeInfo']>>, 'pubkey'>>
  getNetworkInfo(): ReturnType<Rln['getNetworkInfo']>
  getAddress(): ReturnType<Rln['getAddress']>
  getBtcBalance(skipSync?: boolean): ReturnType<Rln['getBtcBalance']>
  listAssets(): ReturnType<Rln['listAssets']>
  listChannels(): ReturnType<Rln['listChannels']>
}

export class KaleidoService {
  constructor(private readonly node: NodeReader, private readonly addresses: AddressStore, private readonly now = () => new Date()) {}

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
}

export type WalletService = Pick<KaleidoService, 'getOverview' | 'createDepositAddress' | 'listDepositAddresses'>

export function createKaleidoService(nodeUrl: string, dbPath: string): WalletService & { close(): Promise<void> } {
  const addresses = new SqliteAddressStore(dbPath)
  const client = KaleidoClient.create({ nodeUrl, timeout: 5 })
  const service = new KaleidoService(client.rln, addresses)
  return {
    getOverview: () => service.getOverview(),
    createDepositAddress: () => service.createDepositAddress(),
    listDepositAddresses: () => service.listDepositAddresses(),
    close: async () => { await client.close(); addresses.close() },
  }
}
