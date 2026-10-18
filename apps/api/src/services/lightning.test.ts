import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BitcoinNetwork, ChannelStatus, InvoiceStatus } from 'kaleido-sdk/rln'
import { LightningService } from './lightning.js'
import type { LightningNodeReader } from './lightning.js'

function fakeNode(channels: Awaited<ReturnType<LightningNodeReader['listChannels']>>['channels'] = []): LightningNodeReader {
  return {
    getNetworkInfo: async () => ({ network: BitcoinNetwork.SignetCustom, height: 100 }),
    getNodeInfo: async () => ({ pubkey: 'our-node' }),
    getBtcBalance: async () => ({
      vanilla: { settled: 460000, future: 460000, spendable: 460000 },
      colored: { settled: 0, future: 0, spendable: 0 },
    }),
    listPeers: async () => ({ peers: [] }),
    listChannels: async () => ({ channels }),
    createLNInvoice: async () => ({ invoice: 'lnbcrtinvoice' }),
    getInvoiceStatus: async () => ({ status: InvoiceStatus.Pending }),
  }
}

test('funded on-chain wallet with no channel is not outbound-ready', async () => {
  const result = await new LightningService(fakeNode(), () => new Date('2026-10-17T12:00:00Z')).getReadiness()
  assert.equal(result.observedAt, '2026-10-17T12:00:00.000Z')
  assert.equal(result.onchainSpendableSat, 460000)
  assert.deepEqual(result.connectedPeers, [])
  assert.deepEqual(result.channels, [])
  assert.equal(result.hasUsableOutbound, false)
})

test('usable channel requires outbound balance, not merely capacity', async () => {
  const channel = {
    channel_id: 'channel-1', peer_pubkey: 'peer-1', status: ChannelStatus.Opened,
    is_usable: true, capacity_sat: 100000, outbound_balance_msat: 0,
    inbound_balance_msat: 100000000, asset_id: null, asset_local_amount: null,
  }
  const node = fakeNode([channel])
  const service = new LightningService(node)
  assert.equal((await service.getReadiness()).hasUsableOutbound, false)
  channel.outbound_balance_msat = 5000000
  const ready = await service.getReadiness()
  assert.equal(ready.hasUsableOutbound, true)
  assert.equal(ready.channels[0].outboundMsat, 5000000)
})

test('BTC invoice requires usable BTC inbound capacity and passes exact millisats to SDK', async () => {
  const channel = { channel_id: 'btc', peer_pubkey: 'peer', status: ChannelStatus.Opened,
    is_usable: true, capacity_sat: 50000, outbound_balance_msat: 1000000,
    inbound_balance_msat: 46240000, asset_id: null, asset_local_amount: null }
  const node = fakeNode([channel])
  const requests: unknown[] = []
  node.createLNInvoice = async (body) => { requests.push(body); return { invoice: 'lnbcrtinvoice' } }
  const service = new LightningService(node)
  assert.deepEqual(await service.createBtcInvoice(1000, 'coffee'), { invoice: 'lnbcrtinvoice', amountSat: 1000, expirySec: 3600 })
  assert.deepEqual(requests, [{ amt_msat: 1000000, expiry_sec: 3600, description: 'coffee' }])
  await assert.rejects(service.createBtcInvoice(46000), /Insufficient/)
  assert.equal(requests.length, 1)
  node.listChannels = async () => ({ channels: [{ ...channel, asset_id: 'rgb:usdt' }] })
  await assert.rejects(service.createBtcInvoice(1000), /Insufficient/)
})
