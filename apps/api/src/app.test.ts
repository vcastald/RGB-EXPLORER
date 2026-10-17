import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from './app.js'
import type { WalletService } from './services/kaleido.js'
import { BitcoinNetwork } from 'kaleido-sdk/rln'

test('node status reports a responding node', async () => {
  const app = createApp({
    fetchNode: async () => Response.json({ pubkey: 'test-pubkey' }),
  })
  try {
    const response = await app.inject('/api/node/status')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { online: true, pubkey: 'test-pubkey' })
  } finally {
    await app.close()
  }
})

test('node status reports an unavailable node', async () => {
  const app = createApp({ fetchNode: async () => { throw new Error('Connection refused') } })
  try {
    const response = await app.inject('/api/node/status')
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { online: false })
  } finally {
    await app.close()
  }
})

test('health endpoint responds', async () => {
  const app = createApp()
  try {
    const response = await app.inject('/api/health')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { status: 'ok' })
  } finally {
    await app.close()
  }
})

const fakeAddress = (address: string) => ({ address, network: BitcoinNetwork.SignetCustom as const, nodePubkey: 'key', createdAt: '2026-10-17T12:00:00.000Z' })

test('wallet overview returns service response', async () => {
  const overview = { observedAt: '2026-10-17T12:00:00.000Z', network: BitcoinNetwork.SignetCustom, height: 1,
    pubkey: 'key', btc: { vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 }, cached: true },
    assets: [], channels: [] } satisfies Awaited<ReturnType<WalletService['getOverview']>>
  const app = createApp({ kaleidoService: { getOverview: async () => overview, createDepositAddress: async () => fakeAddress('tb1-test'), listDepositAddresses: async () => [] } })
    assets: [], channels: [] } satisfies Awaited<ReturnType<OverviewService['getOverview']>>
  const app = createApp({
    kaleidoService: {
      getOverview: async () => overview,
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
    },
  })
  try {
    const response = await app.inject('/api/wallet/overview')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), overview)
  } finally { await app.close() }
})

test('wallet overview returns 503 when node fails', async () => {
  const app = createApp({ kaleidoService: { getOverview: async () => { throw new Error('connection refused') }, createDepositAddress: async () => { throw new Error('connection refused') }, listDepositAddresses: async () => [] } })
  const app = createApp({ kaleidoService: { getOverview: async () => { throw new Error('connection refused') }, getQuotes: async () => ({ observedAt: '', quotes: [] }) } })
  try {
    const response = await app.inject('/api/wallet/overview')
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { error: 'Node unavailable' })
  } finally { await app.close() }
})

test('deposit address route creates a new address with POST', async () => {
  let calls = 0
  const app = createApp({ kaleidoService: {
    getOverview: async () => { throw new Error('not needed') },
    createDepositAddress: async () => fakeAddress(`tb1-test-${++calls}`),
    listDepositAddresses: async () => [fakeAddress('tb1-test-1')],
  } })
  try {
    const listing = await app.inject('/api/wallet/deposit-addresses')
    assert.deepEqual(listing.json(), { addresses: [fakeAddress('tb1-test-1')] })
    const first = await app.inject({ method: 'POST', url: '/api/wallet/deposit-addresses' })
    const second = await app.inject({ method: 'POST', url: '/api/wallet/deposit-addresses' })
    assert.equal(first.statusCode, 201)
    assert.deepEqual(first.json(), fakeAddress('tb1-test-1'))
    assert.equal(second.json().address, 'tb1-test-2')
  } finally { await app.close() }
})

test('deposit address route returns 503 when the node fails', async () => {
  const app = createApp({ kaleidoService: {
    getOverview: async () => { throw new Error('not needed') },
    createDepositAddress: async () => { throw new Error('offline') },
    listDepositAddresses: async () => { throw new Error('offline') },
  } })
  try {
    const response = await app.inject({ method: 'POST', url: '/api/wallet/deposit-addresses' })
    assert.equal(response.statusCode, 503)
  } finally { await app.close() }
})

test('deposit address route flags a storage failure without implying retry is safe', async () => {
  const { AddressStorageError } = await import('./storage/addresses.js')
  const app = createApp({ kaleidoService: {
    getOverview: async () => { throw new Error('not needed') },
    createDepositAddress: async () => { throw new AddressStorageError('disk full') },
    listDepositAddresses: async () => [],
  } })
  try {
    const response = await app.inject({ method: 'POST', url: '/api/wallet/deposit-addresses' })
    assert.equal(response.statusCode, 500)
    assert.match(response.json().error, /do not retry blindly/)
  } finally { await app.close() }
})

test('quotes endpoint returns market quotes', async () => {
  const quotesRes = {
    observedAt: '2026-10-17T12:00:00.000Z',
    quotes: [
      { pair: 'BTC/USDT', baseTicker: 'BTC', quoteTicker: 'USDT', price: 80000, formattedPrice: '80,000.00 USDT', updatedAt: '2026-10-17T12:00:00.000Z' },
    ],
  }
  const app = createApp({
    kaleidoService: {
      getOverview: async () => ({} as any),
      getQuotes: async () => quotesRes,
    },
  })
  try {
    const response = await app.inject('/api/quotes')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), quotesRes)
  } finally { await app.close() }
})

