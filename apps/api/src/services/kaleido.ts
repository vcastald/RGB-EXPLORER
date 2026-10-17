import { KaleidoClient } from 'kaleido-sdk'

type Rln = ReturnType<typeof KaleidoClient.create>['rln']

export interface NodeReader {
  getNodeInfo(): Promise<Pick<Awaited<ReturnType<Rln['getNodeInfo']>>, 'pubkey'>>
  getNetworkInfo(): ReturnType<Rln['getNetworkInfo']>
  getBtcBalance(skipSync?: boolean): ReturnType<Rln['getBtcBalance']>
  listAssets(): ReturnType<Rln['listAssets']>
  listChannels(): ReturnType<Rln['listChannels']>
}

export class KaleidoService {
  constructor(private readonly node: NodeReader, private readonly now = () => new Date()) {}

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

export type OverviewService = Pick<KaleidoService, 'getOverview'>

export function createKaleidoService(nodeUrl: string): OverviewService & { close(): Promise<void> } {
  const client = KaleidoClient.create({ nodeUrl, timeout: 5 })
  const service = new KaleidoService(client.rln)
  return {
    getOverview: () => service.getOverview(),
    close: () => client.close(),
  }
}
