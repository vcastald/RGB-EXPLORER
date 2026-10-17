import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KaleidoService } from './kaleido.js'
import type { NodeReader } from './kaleido.js'
import { BitcoinNetwork } from 'kaleido-sdk/rln'
import { SqliteAddressStore } from '../storage/addresses.js'

test('overview requests a fresh BTC balance', async () => {
  let skipSync: boolean | undefined
  const node = {
    getNodeInfo: async () => ({ pubkey: 'test-key' }),
    getAddress: async () => ({ address: 'tb1-test' }),
    getNetworkInfo: async () => ({ network: BitcoinNetwork.SignetCustom, height: 42 }),
    getBtcBalance: async (skip?: boolean) => {
      skipSync = skip
      return { vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 } }
    },
    listAssets: async () => ({ nia: [], uda: [], cfa: [], ifa: [] }),
    listChannels: async () => ({ channels: [] }),
  } satisfies NodeReader
  const result = await new KaleidoService(node, new SqliteAddressStore(':memory:'), () => new Date('2026-10-17T12:00:00Z')).getOverview()
  assert.equal(skipSync, false)
  assert.deepEqual(result, {
    observedAt: '2026-10-17T12:00:00.000Z', network: 'SignetCustom', height: 42,
    pubkey: 'test-key',
    btc: { vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 }, cached: false },
    assets: [], channels: [],
  })
})

test('address generation checks network before requesting a new address', async () => {
  let calls = 0
  const node = {
    getNetworkInfo: async () => ({ network: BitcoinNetwork.Regtest, height: 1 }),
    getAddress: async () => { calls++; return { address: 'bcrt1-test' } },
  } as NodeReader
  await assert.rejects(() => new KaleidoService(node, new SqliteAddressStore(':memory:')).createDepositAddress(), /Mutinynet/)
  assert.equal(calls, 0)
})

test('address generation returns node-derived address', async () => {
  let calls = 0
  const node = {
    getNetworkInfo: async () => ({ network: BitcoinNetwork.SignetCustom, height: 1 }),
    getAddress: async () => ({ address: `tb1-test-${++calls}` }),
    getNodeInfo: async () => ({ pubkey: 'key' }),
  } as NodeReader
  const service = new KaleidoService(node, new SqliteAddressStore(':memory:'), () => new Date('2026-10-17T12:00:00Z'))
  const expected = (address: string) => ({ address, network: 'SignetCustom', nodePubkey: 'key', createdAt: '2026-10-17T12:00:00.000Z' })
  assert.deepEqual(await service.createDepositAddress(), expected('tb1-test-1'))
  assert.deepEqual(await service.createDepositAddress(), expected('tb1-test-2'))
  assert.deepEqual(await service.listDepositAddresses(), [expected('tb1-test-2'), expected('tb1-test-1')])
})

test('quotes maps market pairs to structured quotes', async () => {
  const market = {
    listPairs: async () => ({
      pairs: [
        { ticker: 'BTC/USDT', price: '80000000000', base: { ticker: 'BTC', precision: 11 }, quote: { ticker: 'USDT', precision: 6 }, is_active: true },
        { ticker: 'BTC/XAUT', price: '20000000000', base: { ticker: 'BTC', precision: 11 }, quote: { ticker: 'XAUT', precision: 9 }, is_active: true },
        { ticker: 'XAUT/USDT', price: '4000000000', base: { ticker: 'XAUT', precision: 9 }, quote: { ticker: 'USDT', precision: 6 }, is_active: true },
      ],
    }),
  }
  const service = new KaleidoService({} as any, new SqliteAddressStore(':memory:'), market as any, () => new Date('2026-10-17T12:00:00Z'))
  const res = await service.getQuotes()
  assert.equal(res.quotes.length, 3)
  assert.equal(res.quotes[0].pair, 'BTC/USDT')
  assert.equal(res.quotes[0].price, 80000)
  assert.equal(res.quotes[1].pair, 'BTC/XAUT')
  assert.equal(res.quotes[1].price, 20)
  assert.equal(res.quotes[2].pair, 'USDT/XAUT')
  assert.equal(res.quotes[2].price, 0.00025)
  assert.equal(res.quotes[2].inversePrice, 4000)
})
