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

const fakeAddress = (address: string) => ({
  address,
  network: BitcoinNetwork.SignetCustom as const,
  nodePubkey: 'key',
  createdAt: '2026-10-17T12:00:00.000Z',
})

const emptyPayments = async () => ({
  observedAt: '2026-10-17T12:00:00.000Z',
  payments: [],
  channelLiquidity: {
    totalCapacitySat: 0,
    localBalanceSat: 0,
    remoteBalanceSat: 0,
    localBalanceBtc: 0,
    capacityBtc: 0,
    channelsCount: 0,
  },
})

const emptyTransfers = async () => ({
  observedAt: '2026-10-17T12:00:00.000Z',
  transfers: [],
})

test('wallet overview returns service response', async () => {
  const overview = {
    observedAt: '2026-10-17T12:00:00.000Z',
    network: BitcoinNetwork.SignetCustom,
    height: 1,
    pubkey: 'key',
    btc: { vanilla: { settled: 0, future: 0, spendable: 0 }, colored: { settled: 0, future: 0, spendable: 0 }, cached: false },
    assets: [],
    channels: [],
  } satisfies Awaited<ReturnType<WalletService['getOverview']>>

  const app = createApp({
    kaleidoService: {
      getOverview: async () => overview,
      createDepositAddress: async () => fakeAddress('tb1-test'),
      listDepositAddresses: async () => [],
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
      listTransactions: async () => ({ observedAt: '', transactions: [] }),
      listPayments: emptyPayments,
      listTransfers: emptyTransfers,
    },
  })
  try {
    const response = await app.inject('/api/wallet/overview')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), overview)
  } finally {
    await app.close()
  }
})

test('wallet overview returns 503 when node fails', async () => {
  const app = createApp({
    kaleidoService: {
      getOverview: async () => { throw new Error('connection refused') },
      createDepositAddress: async () => { throw new Error('connection refused') },
      listDepositAddresses: async () => [],
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
      listTransactions: async () => ({ observedAt: '', transactions: [] }),
      listPayments: emptyPayments,
      listTransfers: emptyTransfers,
    },
  })
  try {
    const response = await app.inject('/api/wallet/overview')
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { error: 'Node unavailable' })
  } finally {
    await app.close()
  }
})

test('deposit address route creates a new address with POST', async () => {
  let calls = 0
  const app = createApp({
    kaleidoService: {
      getOverview: async () => { throw new Error('not needed') },
      createDepositAddress: async () => fakeAddress(`tb1-test-${++calls}`),
      listDepositAddresses: async () => [fakeAddress('tb1-test-1')],
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
      listTransactions: async () => ({ observedAt: '', transactions: [] }),
      listPayments: emptyPayments,
      listTransfers: emptyTransfers,
    },
  })
  try {
    const listing = await app.inject('/api/wallet/deposit-addresses')
    assert.deepEqual(listing.json(), { addresses: [fakeAddress('tb1-test-1')] })
    const first = await app.inject({ method: 'POST', url: '/api/wallet/deposit-addresses' })
    const second = await app.inject({ method: 'POST', url: '/api/wallet/deposit-addresses' })
    assert.equal(first.statusCode, 201)
    assert.deepEqual(first.json(), fakeAddress('tb1-test-1'))
    assert.equal(second.json().address, 'tb1-test-2')
  } finally {
    await app.close()
  }
})

test('deposit address route returns 503 when the node fails', async () => {
  const app = createApp({
    kaleidoService: {
      getOverview: async () => { throw new Error('not needed') },
      createDepositAddress: async () => { throw new Error('offline') },
      listDepositAddresses: async () => { throw new Error('offline') },
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
      listTransactions: async () => ({ observedAt: '', transactions: [] }),
      listPayments: emptyPayments,
      listTransfers: emptyTransfers,
    },
  })
  try {
    const response = await app.inject({ method: 'POST', url: '/api/wallet/deposit-addresses' })
    assert.equal(response.statusCode, 503)
  } finally {
    await app.close()
  }
})

test('deposit address route flags a storage failure without implying retry is safe', async () => {
  const { AddressStorageError } = await import('./storage/addresses.js')
  const app = createApp({
    kaleidoService: {
      getOverview: async () => { throw new Error('not needed') },
      createDepositAddress: async () => { throw new AddressStorageError('disk full') },
      listDepositAddresses: async () => [],
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
      listTransactions: async () => ({ observedAt: '', transactions: [] }),
      listPayments: emptyPayments,
      listTransfers: emptyTransfers,
    },
  })
  try {
    const response = await app.inject({ method: 'POST', url: '/api/wallet/deposit-addresses' })
    assert.equal(response.statusCode, 500)
    assert.match(response.json().error, /do not retry blindly/)
  } finally {
    await app.close()
  }
})

test('quotes endpoint returns market quotes', async () => {
  const quotesRes = {
    observedAt: '2026-10-17T12:00:00.000Z',
    quotes: [
      {
        pair: 'BTC/USDT',
        baseTicker: 'BTC',
        quoteTicker: 'USDT',
        price: 80000,
        formattedPrice: '80.000,00 USDT',
        updatedAt: '2026-10-17T12:00:00.000Z',
      },
    ],
  }
  const app = createApp({
    kaleidoService: {
      getOverview: async () => ({} as any),
      createDepositAddress: async () => ({} as any),
      listDepositAddresses: async () => [],
      getQuotes: async () => quotesRes,
      listTransactions: async () => ({ observedAt: '', transactions: [] }),
      listPayments: emptyPayments,
      listTransfers: emptyTransfers,
    },
  })
  try {
    const response = await app.inject('/api/quotes')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), quotesRes)
  } finally {
    await app.close()
  }
})

test('transactions endpoint returns node transactions', async () => {
  const txData = {
    observedAt: '2026-10-17T12:00:00.000Z',
    transactions: [
      {
        id: 'tx-1',
        txid: 'tx-1',
        timestamp: '2026-10-17T12:00:00.000Z',
        asset: 'BTC' as const,
        amount: 0.1,
        unit: 'BTC',
        receivedSats: 10000000,
        sentSats: 0,
        feeSats: 200,
        direction: 'incoming' as const,
        status: 'settled' as const,
        blockHeight: 100,
        transactionType: 'User',
        sender: {
          name: 'Bitcoin On-Chain Deposit',
          identifier: 'tx-1',
          type: 'node' as const,
        },
        memo: 'On-chain User',
      },
    ],
  }
  const app = createApp({
    kaleidoService: {
      getOverview: async () => ({} as any),
      createDepositAddress: async () => ({} as any),
      listDepositAddresses: async () => [],
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
      listTransactions: async () => txData,
      listPayments: emptyPayments,
      listTransfers: emptyTransfers,
    },
  })
  try {
    const resWallet = await app.inject('/api/wallet/transactions')
    assert.equal(resWallet.statusCode, 200)
    assert.deepEqual(resWallet.json(), txData)

    const resAlias = await app.inject('/api/transactions')
    assert.equal(resAlias.statusCode, 200)
    assert.deepEqual(resAlias.json(), txData)
  } finally {
    await app.close()
  }
})

test('payments endpoint returns lightning payments and channel liquidity', async () => {
  const paymentsData = {
    observedAt: '2026-10-17T12:00:00.000Z',
    payments: [
      {
        id: 'pay-1',
        paymentHash: 'pay-1',
        timestamp: '2026-10-17T12:00:00.000Z',
        asset: 'BTC',
        amount: 0.00001,
        unit: 'BTC',
        amtMsat: 1000000,
        assetAmount: null,
        assetId: null,
        direction: 'incoming' as const,
        status: 'settled' as const,
        payeePubkey: '021638f19de2140cf23db6efcf8ef30a2e5e542ed32112c53b4e14b538742d70a2',
        preimage: 'preimage-1',
        description: 'test payment',
        sender: {
          name: 'Lightning Payment Received',
          identifier: '021638f19de2140cf23db6efcf8ef30a2e5e542ed32112c53b4e14b538742d70a2',
          type: 'node' as const,
        },
        memo: 'test payment',
        paymentType: 'lightning' as const,
      },
    ],
    channelLiquidity: {
      totalCapacitySat: 50000,
      localBalanceSat: 3100,
      remoteBalanceSat: 46900,
      localBalanceBtc: 0.000031,
      capacityBtc: 0.0005,
      channelsCount: 1,
    },
  }

  const app = createApp({
    kaleidoService: {
      getOverview: async () => ({} as any),
      createDepositAddress: async () => ({} as any),
      listDepositAddresses: async () => [],
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
      listTransactions: async () => ({ observedAt: '', transactions: [] }),
      listPayments: async () => paymentsData,
      listTransfers: emptyTransfers,
    },
  })
  try {
    const resWallet = await app.inject('/api/wallet/payments')
    assert.equal(resWallet.statusCode, 200)
    assert.deepEqual(resWallet.json(), paymentsData)

    const resAlias = await app.inject('/api/payments')
    assert.equal(resAlias.statusCode, 200)
    assert.deepEqual(resAlias.json(), paymentsData)
  } finally {
    await app.close()
  }
})

test('transfers endpoint returns on-chain RGB transfers', async () => {
  const transfersData = {
    observedAt: '2026-10-17T12:00:00.000Z',
    transfers: [
      {
        id: 'tx-usdt-1:1',
        idx: 1,
        txid: 'tx-usdt-1',
        timestamp: '2026-10-17T12:00:00.000Z',
        asset: 'USDT',
        amount: 250,
        unit: 'USDT',
        direction: 'incoming' as const,
        status: 'settled' as const,
        kind: 'ReceiveBlind',
        recipientId: 'blinded-1',
        receiveUtxo: null,
        changeUtxo: null,
        sender: {
          name: 'RGB On-Chain USDT Deposit',
          identifier: 'tx-usdt-1',
          type: 'node' as const,
        },
        memo: 'On-chain RGB USDT transfer (ReceiveBlind)',
        paymentType: 'onchain' as const,
        assetId: 'rgb:usdt-id',
      },
    ],
  }

  const app = createApp({
    kaleidoService: {
      getOverview: async () => ({} as any),
      createDepositAddress: async () => ({} as any),
      listDepositAddresses: async () => [],
      getQuotes: async () => ({ observedAt: '', quotes: [] }),
      listTransactions: async () => ({ observedAt: '', transactions: [] }),
      listPayments: emptyPayments,
      listTransfers: async () => transfersData,
    },
  })
  try {
    const resWallet = await app.inject('/api/wallet/transfers')
    assert.equal(resWallet.statusCode, 200)
    assert.deepEqual(resWallet.json(), transfersData)

    const resAlias = await app.inject('/api/transfers')
    assert.equal(resAlias.statusCode, 200)
    assert.deepEqual(resAlias.json(), transfersData)
  } finally {
    await app.close()
  }
})
