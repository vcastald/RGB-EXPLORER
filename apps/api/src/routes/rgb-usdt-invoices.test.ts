import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { InvalidRgbAmount, RgbReceiveUnavailable } from '../services/rgb-usdt-invoices.js'
test('on-chain invoice route accepts amount-free and decimal requests', async () => {
  const calls: unknown[] = []
  const app = createApp({ rgbUsdtInvoiceService: { createInvoice: async amount => { calls.push(amount); return { invoice: 'rgb:test' } as never } } })
  try {
    for (const payload of [{}, { amountUsdt: '0.1' }]) {
      const res = await app.inject({ method: 'POST', url: '/api/rgb/usdt/invoices', payload })
      assert.equal(res.statusCode, 201); assert.equal(res.json().invoice, 'rgb:test')
    }
    assert.deepEqual(calls, [undefined, '0.1'])
    assert.equal((await app.inject({ method: 'POST', url: '/api/rgb/usdt/invoices', payload: { amountUsdt: '-1' } })).statusCode, 400)
    assert.equal(calls.length, 2)
  } finally { await app.close() }
})
test('on-chain errors distinguish invalid amounts, prerequisites and node failures', async () => {
  for (const [error, status] of [[new InvalidRgbAmount('invalid'), 400], [new RgbReceiveUnavailable('unknown asset'), 409], [new Error('timeout'), 503]] as const) {
    const app = createApp({ rgbUsdtInvoiceService: { createInvoice: async () => { throw error } } })
    try { assert.equal((await app.inject({ method: 'POST', url: '/api/rgb/usdt/invoices', payload: {} })).statusCode, status) }
    finally { await app.close() }
  }
})
