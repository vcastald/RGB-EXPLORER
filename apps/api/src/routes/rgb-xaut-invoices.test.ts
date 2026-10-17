import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { RgbReceiveUnavailable, InvalidRgbAmount } from '../services/rgb-usdt-invoices.js'
test('XAUT route passes precision and explicit bootstrap options', async () => {
  const calls: unknown[] = []
  const app = createApp({ rgbXautInvoiceService: { createInvoice: async (amount, any) => { calls.push([amount, any]); return { invoice: 'rgb:test' } as never } } })
  try {
    for (const payload of [{ amountXaut: '0.000000001' }, { allowAnyAsset: true }]) {
      assert.equal((await app.inject({ method: 'POST', url: '/api/rgb/xaut/invoices', payload })).statusCode, 201)
    }
    assert.deepEqual(calls, [['0.000000001', false], [undefined, true]])
    assert.equal((await app.inject({ method: 'POST', url: '/api/rgb/xaut/invoices', payload: { amountXaut: '0.0000000001' } })).statusCode, 400)
    assert.equal(calls.length, 2)
  } finally { await app.close() }
})
test('XAUT errors have safe HTTP responses', async () => {
  for (const [error, status] of [[new RgbReceiveUnavailable('Unknown XAUT'), 409], [new InvalidRgbAmount('bad amount'), 400], [new Error('timeout'), 503]] as const) {
    const app = createApp({ rgbXautInvoiceService: { createInvoice: async () => { throw error } } })
    try { assert.equal((await app.inject({ method: 'POST', url: '/api/rgb/xaut/invoices', payload: {} })).statusCode, status) }
    finally { await app.close() }
  }
})
