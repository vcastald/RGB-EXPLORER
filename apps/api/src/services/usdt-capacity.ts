import { KaleidoClient } from 'kaleido-sdk'

export const MUTINYNET_USDT = 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0'
const CLIENT_SAT = 20000
const LSP_SAT = 50000
const EXPIRY_BLOCKS = 13140

type Rln = ReturnType<typeof KaleidoClient.create>['rln']
type Maker = ReturnType<typeof KaleidoClient.create>['maker']
export type UsdtNode = Pick<Rln, 'getNetworkInfo' | 'listChannels'>
export type UsdtMaker = Pick<Maker, 'getLspInfo' | 'estimateLspFees'>

export class UnsupportedUsdtProposal extends Error {}
export class LspUnavailable extends Error {}

export class UsdtCapacityService {
  constructor(private readonly node: UsdtNode, private readonly maker: UsdtMaker) {}

  async getCapacity() {
    const [network, listed] = await Promise.all([
      this.node.getNetworkInfo(), this.node.listChannels(),
    ])
    if (network.network.toLowerCase() !== 'signetcustom') throw new UnsupportedUsdtProposal('Mutinynet node required')
    const channels = listed.channels.filter((channel) => channel.asset_id === MUTINYNET_USDT)
      .map((channel) => ({ channelId: channel.channel_id, status: channel.status,
        ready: channel.ready, usable: channel.is_usable,
        inboundMsat: channel.inbound_balance_msat,
        remoteAssetUnits: channel.asset_remote_amount ?? null,
        localAssetUnits: channel.asset_local_amount ?? null }))
    return { network: network.network, assetId: MUTINYNET_USDT,
      assetPrecision: 6, channels,
      usableInboundAssetUnits: channels.filter((channel) => channel.ready && channel.usable)
        .reduce((sum, channel) => sum + (channel.remoteAssetUnits ?? 0), 0) }
  }

  async estimate(additionalUsdt: number) {
    if (!Number.isSafeInteger(additionalUsdt) || additionalUsdt < 1 || additionalUsdt > 1000) {
      throw new UnsupportedUsdtProposal('Choose a whole number of test-USDT from 1 to 1000')
    }
    const existing = await this.getCapacity()
    let info: Awaited<ReturnType<UsdtMaker['getLspInfo']>>
    try { info = await this.maker.getLspInfo() }
    catch { throw new LspUnavailable('LSP capabilities unavailable; retry lookup later') }
    const asset = info.assets.find((entry) => entry.asset_id === MUTINYNET_USDT && entry.ticker === 'USDT' && entry.precision === 6)
    if (!asset) throw new UnsupportedUsdtProposal('Expected Mutinynet USDT not advertised by LSP')
    const raw = additionalUsdt * 1_000_000
    const opts = info.options
    if (raw < asset.min_initial_lsp_amount || raw > asset.max_initial_lsp_amount ||
        raw < asset.min_channel_amount || raw > asset.max_channel_amount ||
        0 < asset.min_initial_client_amount || 0 > asset.max_initial_client_amount ||
        LSP_SAT + CLIENT_SAT < opts.min_channel_balance_sat || LSP_SAT + CLIENT_SAT > opts.max_channel_balance_sat ||
        LSP_SAT < opts.min_initial_lsp_balance_sat || LSP_SAT > opts.max_initial_lsp_balance_sat ||
        CLIENT_SAT < opts.min_initial_client_balance_sat || CLIENT_SAT > opts.max_initial_client_balance_sat ||
        EXPIRY_BLOCKS > opts.max_channel_expiry_blocks || 1 < opts.min_required_channel_confirmations ||
        6 < Math.max(1, opts.min_funding_confirms_within_blocks)) {
      throw new UnsupportedUsdtProposal('Proposal outside live LSP limits')
    }
    let fees: Awaited<ReturnType<UsdtMaker['estimateLspFees']>>
    try { fees = await this.maker.estimateLspFees({ lsp_balance_sat: LSP_SAT,
      client_balance_sat: CLIENT_SAT, channel_expiry_blocks: EXPIRY_BLOCKS,
      asset_id: asset.asset_id, lsp_asset_amount: raw, client_asset_amount: 0 }) }
    catch { throw new LspUnavailable('LSP fee estimate unavailable; retry lookup later') }
    return { existing, proposed: { lspBalanceSat: LSP_SAT, clientBalanceSat: CLIENT_SAT,
      lspAssetUnits: raw, clientAssetUnits: 0, channelExpiryBlocks: EXPIRY_BLOCKS,
      requiredChannelConfirmations: 1, fundingConfirmsWithinBlocks: 6, announceChannel: true },
      fees, estimatedClientBalancePlusFeeSat: CLIENT_SAT + fees.total_fee,
      note: 'Read-only estimate, NOT final order total. No order or payment created. Miner fee is additional.' }
  }
}

export type UsdtCapacityReader = Pick<UsdtCapacityService, 'getCapacity' | 'estimate'>

export function createUsdtCapacityService(nodeUrl: string): UsdtCapacityReader & { close(): Promise<void> } {
  const client = KaleidoClient.create({ nodeUrl,
    baseUrl: process.env.USDT_LSP_URL ?? 'https://api.mutinynet2.kaleidoswap.com', timeout: 10000 })
  const service = new UsdtCapacityService(client.rln, client.maker)
  return { getCapacity: () => service.getCapacity(), estimate: (amount) => service.estimate(amount),
    close: () => client.close() }
}
