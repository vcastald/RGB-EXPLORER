import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KaleidoService } from './kaleido.js'
import type { NodeReader } from './kaleido.js'
import { BitcoinNetwork } from 'kaleido-sdk/rln'

test('overview maps an empty node and uses cached BTC balance', async () => {
  let skipSync: boolean | undefined
  const node = {
    getNodeInfo: async () => ({ pubkey: 'test-key' }),
    getNetworkInfo: async () => ({ network: BitcoinNetwork.SignetCustom, height: 42 }),
    getBtcBalance: async (skip?: boolean) => {
      skipSync = skip
      return { vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 } }
    },
    listAssets: async () => ({ nia: [], uda: [], cfa: [], ifa: [] }),
    listChannels: async () => ({ channels: [] }),
  } satisfies NodeReader
  const result = await new KaleidoService(node, () => new Date('2026-10-17T12:00:00Z')).getOverview()
  assert.equal(skipSync, true)
  assert.deepEqual(result, {
    observedAt: '2026-10-17T12:00:00.000Z', network: 'SignetCustom', height: 42,
    pubkey: 'test-key',
    btc: { vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 }, cached: true },
    assets: [], channels: [],
  })
})
