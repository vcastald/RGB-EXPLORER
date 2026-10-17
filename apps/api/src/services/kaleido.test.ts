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
    listTransactions: async () => ({ transactions: [] }),
    listPayments: async () => ({ payments: [] }),
  } satisfies NodeReader
  const result = await new KaleidoService(node, new SqliteAddressStore(':memory:'), () => new Date('2026-10-17T12:00:00Z')).getOverview()
  assert.equal(skipSync, true)
  assert.deepEqual(result, {
    observedAt: '2026-10-17T12:00:00.000Z', network: 'SignetCustom', height: 42,
    pubkey: 'test-key',
    btc: { vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 }, cached: true },
    assets: [], channels: [],
  })
})

test('address generation checks network before requesting a new address', async () => {
  let calls = 0
  const node = {
    getNetworkInfo: async () => ({ network: BitcoinNetwork.Regtest, height: 1 }),
    getAddress: async () => { calls++; return { address: 'bcrt1-test' } },
    listTransactions: async () => ({ transactions: [] }),
  } as unknown as NodeReader
  await assert.rejects(() => new KaleidoService(node, new SqliteAddressStore(':memory:')).createDepositAddress(), /Mutinynet/)
  assert.equal(calls, 0)
})

test('address generation returns node-derived address', async () => {
  let calls = 0
  const node = {
    getNetworkInfo: async () => ({ network: BitcoinNetwork.SignetCustom, height: 1 }),
    getAddress: async () => ({ address: `tb1-test-${++calls}` }),
    getNodeInfo: async () => ({ pubkey: 'key' }),
    listTransactions: async () => ({ transactions: [] }),
  } as unknown as NodeReader
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

test('listTransactions maps on-chain transactions to normalized BTC records', async () => {
  const node = {
    listTransactions: async () => ({
      transactions: [
        {
          transaction_type: 'User' as any,
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          received: 5000000,
          sent: 0,
          fee: 150,
          confirmation_time: { height: 123456, timestamp: 1770000000 },
        },
      ],
    }),
  } as unknown as NodeReader
  const service = new KaleidoService(node, new SqliteAddressStore(':memory:'), () => new Date('2026-10-17T12:00:00Z'))
  const res = await service.listTransactions()
  assert.equal(res.transactions.length, 1)
  const tx = res.transactions[0]
  assert.equal(tx.txid, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
  assert.equal(tx.amount, 0.05)
  assert.equal(tx.asset, 'BTC')
  assert.equal(tx.direction, 'incoming')
  assert.equal(tx.status, 'settled')
})

test('listPayments maps node payments and channel liquidity', async () => {
  const node = {
    listPayments: async () => ({
      payments: [
        {
          amt_msat: 1000000,
          asset_amount: null,
          asset_id: null,
          payment_hash: '94271e2152dcb1d343d77f7175aaebb4a806718d349de9416f5b9b1bf04999f8',
          inbound: true,
          status: 'Succeeded' as any,
          created_at: 1770000000,
          updated_at: 1770000050,
          payee_pubkey: '021638f19de2140cf23db6efcf8ef30a2e5e542ed32112c53b4e14b538742d70a2',
          preimage: 'd8fcc2bb7ff482e957d7e4ed2a36f6fa351b794f39bb01853ad770954e99d47a',
          description: 'test payment',
        },
      ],
    }),
    listChannels: async () => ({
      channels: [
        {
          channel_id: 'chan-1',
          peer_pubkey: 'peer-1',
          status: 'Opened' as any,
          ready: true,
          capacity_sat: 50000,
          local_balance_sat: 3100,
          outbound_balance_msat: 2100000,
          inbound_balance_msat: 45240000,
          is_usable: true,
          public: false,
          asset_id: null,
          asset_local_amount: null,
          asset_remote_amount: null,
        },
        {
          channel_id: 'chan-rgb-2',
          peer_pubkey: 'peer-2',
          status: 'Opened' as any,
          ready: true,
          capacity_sat: 200000,
          local_balance_sat: 10000,
          outbound_balance_msat: 0,
          inbound_balance_msat: 0,
          is_usable: true,
          public: false,
          asset_id: 'rgb:test-asset-id',
          asset_local_amount: 500,
          asset_remote_amount: 500,
        },
      ],
    }),
  } as unknown as NodeReader
  const service = new KaleidoService(node, new SqliteAddressStore(':memory:'), () => new Date('2026-10-17T12:00:00Z'))
  const res = await service.listPayments()
  assert.equal(res.payments.length, 1)
  const payment = res.payments[0]
  assert.equal(payment.paymentHash, '94271e2152dcb1d343d77f7175aaebb4a806718d349de9416f5b9b1bf04999f8')
  assert.equal(payment.amount, 0.00001)
  assert.equal(payment.asset, 'BTC')
  assert.equal(payment.direction, 'incoming')
  assert.equal(payment.status, 'settled')
  assert.equal(payment.paymentType, 'lightning')
  assert.equal(payment.memo, 'test payment')

  assert.equal(res.channelLiquidity.channelsCount, 1)
  assert.equal(res.channelLiquidity.totalCapacitySat, 50000)
  assert.equal(res.channelLiquidity.localBalanceSat, 3100)
  assert.equal(res.channelLiquidity.capacityBtc, 0.0005)
  assert.equal(res.channelLiquidity.localBalanceBtc, 0.000031)
})
