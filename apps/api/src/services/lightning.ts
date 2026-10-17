import { KaleidoClient } from 'kaleido-sdk'

type Rln = ReturnType<typeof KaleidoClient.create>['rln']

type Channel = Awaited<ReturnType<Rln['listChannels']>>['channels'][number]

export interface LightningNodeReader {
  getNodeInfo(): Promise<Pick<Awaited<ReturnType<Rln['getNodeInfo']>>, 'pubkey'>>
  getNetworkInfo(): ReturnType<Rln['getNetworkInfo']>
  getBtcBalance(skipSync?: boolean): ReturnType<Rln['getBtcBalance']>
  listPeers(): ReturnType<Rln['listPeers']>
  listChannels(): Promise<{ channels: Pick<Channel,
    'channel_id' | 'peer_pubkey' | 'status' | 'is_usable' | 'capacity_sat' |
    'outbound_balance_msat' | 'inbound_balance_msat' | 'asset_id' | 'asset_local_amount'>[] }>
}

export class LightningService {
  constructor(private readonly node: LightningNodeReader, private readonly now = () => new Date()) {}

  async getReadiness() {
    const [network, info, btc, peers, channels] = await Promise.all([
      this.node.getNetworkInfo(), this.node.getNodeInfo(), this.node.getBtcBalance(false),
      this.node.listPeers(), this.node.listChannels(),
    ])
    const listedChannels = channels.channels.map((channel) => ({
      channelId: channel.channel_id,
      peerPubkey: channel.peer_pubkey,
      status: channel.status,
      usable: channel.is_usable,
      capacitySat: channel.capacity_sat,
      outboundMsat: channel.outbound_balance_msat,
      inboundMsat: channel.inbound_balance_msat,
      assetId: channel.asset_id ?? null,
      assetLocalAmount: channel.asset_local_amount ?? null,
    }))
    return {
      observedAt: this.now().toISOString(),
      network: network.network,
      pubkey: info.pubkey,
      onchainSpendableSat: btc.vanilla.spendable,
      connectedPeers: peers.peers.map((peer) => peer.pubkey),
      channels: listedChannels,
      hasUsableOutbound: listedChannels.some((channel) => channel.usable && channel.outboundMsat > 0),
    }
  }
}

export type LightningReadinessService = Pick<LightningService, 'getReadiness'>

export function createLightningService(nodeUrl: string): LightningReadinessService & { close(): Promise<void> } {
  const client = KaleidoClient.create({ nodeUrl, timeout: 30 })
  const service = new LightningService(client.rln)
  return { getReadiness: () => service.getReadiness(), close: () => client.close() }
}
