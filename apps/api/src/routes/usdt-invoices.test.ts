import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { UsdtInvoiceUnavailable } from '../services/usdt-invoices.js'

test('USDT invoice route creates invoices and rejects invalid payloads', async () => {
  const calls: unknown[] = []
  const app = createApp({ usdtInvoiceService: { createInvoice: async (amount, description) => {
    calls.push({ amount, description }); return { invoice: 'ln-test' } as never
  } } })
  try {
    for (const payload of [{}, { amountUsdt: '-1' }, { amountUsdt: '1.0000001' }, { amountUsdt: '1', description: 'x'.repeat(201) }]) {
      assert.equal((await app.inject({ method: 'POST', url: '/api/lightning/usdt/invoices', payload })).statusCode, 400)
    }
    assert.equal(calls.length, 0)
    const response = await app.inject({ method: 'POST', url: '/api/lightning/usdt/invoices', payload: { amountUsdt: '1', description: 'Sale' } })
    assert.equal(response.statusCode, 201)
    assert.deepEqual(calls, [{ amount: '1', description: 'Sale' }])
  } finally { await app.close() }
})
test('capacity failures and uncertain node failures have distinct responses', async () => {
  for (const [error, status] of [[new UsdtInvoiceUnavailable('Insufficient capacity'), 409], [new Error('timeout'), 503]] as const) {
    const app = createApp({ usdtInvoiceService: { createInvoice: async () => { throw error } } })
    try { assert.equal((await app.inject({ method: 'POST', url: '/api/lightning/usdt/invoices', payload: { amountUsdt: '1' } })).statusCode, status) }
    finally { await app.close() }
  }
})
