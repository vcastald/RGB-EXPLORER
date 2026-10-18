import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BitcoinNetwork, ChannelStatus } from 'kaleido-sdk/rln'
import { MUTINYNET_USDT, UsdtCapacityService } from './usdt-capacity.js'
import type { UsdtMaker, UsdtNode } from './usdt-capacity.js'

const channels = [{ channel_id: 'rgb-channel', asset_id: MUTINYNET_USDT, status: ChannelStatus.Opened,
  ready: true, is_usable: true, inbound_balance_msat: 40000000,
  asset_remote_amount: 20000000, asset_local_amount: 0 }]
const node = {
  getNetworkInfo: async () => ({ network: BitcoinNetwork.SignetCustom, height: 100 }),
  listChannels: async () => ({ channels }),
} as UsdtNode
const options = { min_channel_balance_sat: 50000, max_channel_balance_sat: 1000000,
  min_initial_lsp_balance_sat: 0, max_initial_lsp_balance_sat: 1000000,
  min_initial_client_balance_sat: 0, max_initial_client_balance_sat: 1000000,
  max_channel_expiry_blocks: 20160, min_required_channel_confirmations: 0,
  min_funding_confirms_within_blocks: 1 }
const asset = { asset_id: MUTINYNET_USDT, ticker: 'USDT', precision: 6,
  min_initial_lsp_amount: 0, max_initial_lsp_amount: 50000000,
  min_channel_amount: 0, max_channel_amount: 50000000,
  min_initial_client_amount: 0, max_initial_client_amount: 0 }

test('local capacity works without contacting LSP', async () => {
  const maker = { getLspInfo: async () => { throw Error('must not contact LSP') } } as unknown as UsdtMaker
  const result = await new UsdtCapacityService(node, maker).getCapacity()
  assert.equal(result.usableInboundAssetUnits, 20000000)
  assert.equal(result.channels[0].channelId, 'rgb-channel')
})

test('estimate sends only receiving-only allocation and returns estimate, not final price', async () => {
  const requests: unknown[] = []
  const maker = { getLspInfo: async () => ({ options, assets: [asset] }),
    estimateLspFees: async (request: unknown) => { requests.push(request); return { total_fee: 4014 } } } as UsdtMaker
  const result = await new UsdtCapacityService(node, maker).estimate(20)
  assert.equal(result.estimatedClientBalancePlusFeeSat, 24014)
  assert.deepEqual(requests, [{ lsp_balance_sat: 50000, client_balance_sat: 20000,
    channel_expiry_blocks: 13140, asset_id: MUTINYNET_USDT, lsp_asset_amount: 20000000, client_asset_amount: 0 }])
})
