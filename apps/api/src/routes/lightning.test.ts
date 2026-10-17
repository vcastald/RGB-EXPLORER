import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { BitcoinNetwork, InvoiceStatus } from 'kaleido-sdk/rln'
import type { LightningReadinessService } from '../services/lightning.js'

test('readiness route returns service snapshot', async () => {
  const snapshot = { observedAt: '2026-10-17T12:00:00Z', network: BitcoinNetwork.SignetCustom, pubkey: 'node', onchainSpendableSat: 0, connectedPeers: [], channels: [], hasUsableOutbound: false } satisfies Awaited<ReturnType<LightningReadinessService['getReadiness']>>
  const app = createApp({ lightningService: { getReadiness: async () => snapshot,
    createBtcInvoice: async () => ({ invoice: 'lnbcrtinvoice', amountSat: 1000, expirySec: 3600 }),
    getBtcInvoiceStatus: async () => ({ status: InvoiceStatus.Pending }) } })
  try {
    const response = await app.inject('/api/lightning/readiness')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), snapshot)
  } finally { await app.close() }
})

test('readiness route returns 503 on node failure', async () => {
  const app = createApp({ lightningService: { getReadiness: async () => { throw Error('node offline') },
    createBtcInvoice: async () => { throw Error('node offline') },
    getBtcInvoiceStatus: async () => { throw Error('node offline') } } })
  try {
    const response = await app.inject('/api/lightning/readiness')
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { error: 'Node unavailable' })
  } finally { await app.close() }
})

test('BTC invoice creation validates amounts and does not create on invalid input', async () => {
  const calls: Array<[number, string | undefined]> = []
  const app = createApp({ lightningService: { getReadiness: async () => { throw Error('unused') },
    createBtcInvoice: async (amount, description) => { calls.push([amount, description]); return { invoice: 'lnbcrtinvoice', amountSat: amount, expirySec: 3600 } },
    getBtcInvoiceStatus: async () => ({ status: InvoiceStatus.Pending }) } })
  try {
    for (const amountSat of [0, -1, 40001, 1.5]) {
      const response = await app.inject({ method: 'POST', url: '/api/lightning/invoices', payload: { amountSat } })
      assert.equal(response.statusCode, 400)
    }
    assert.equal(calls.length, 0)
    const response = await app.inject({ method: 'POST', url: '/api/lightning/invoices', payload: { amountSat: 1000, description: 'test' } })
    assert.equal(response.statusCode, 201)
    assert.deepEqual(response.json(), { invoice: 'lnbcrtinvoice', amountSat: 1000, expirySec: 3600 })
    assert.deepEqual(calls, [[1000, 'test']])
  } finally { await app.close() }
})

test('BTC invoice status accepts body, not URL or unbounded input', async () => {
  const invoices: string[] = []
  const app = createApp({ lightningService: { getReadiness: async () => { throw Error('unused') },
    createBtcInvoice: async () => { throw Error('unused') },
    getBtcInvoiceStatus: async (invoice) => { invoices.push(invoice); return { status: InvoiceStatus.Pending } } } })
  try {
    assert.equal((await app.inject({ method: 'POST', url: '/api/lightning/invoices/status', payload: { invoice: 'no' } })).statusCode, 400)
    const response = await app.inject({ method: 'POST', url: '/api/lightning/invoices/status', payload: { invoice: 'lnbcrtinvoice' } })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(invoices, ['lnbcrtinvoice'])
  } finally { await app.close() }
})
