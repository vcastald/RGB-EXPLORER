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

test('USDT route forwards bootstrap permission to fresh-wallet service', async () => {
  const { RgbUsdtInvoiceService } = await import('../services/rgb-usdt-invoices.js')
  const service = new RgbUsdtInvoiceService({
    getNetworkInfo: async () => ({ network: 'SignetCustom' }),
    listAssets: async () => ({ nia: [] }),
    createRgbInvoice: async () => ({ invoice: 'rgb:bootstrap', recipient_id: 'r', batch_transfer_idx: 1, expiration_timestamp: 9999999999 }),
  } as never)
  const app = createApp({ rgbUsdtInvoiceService: service })
  try {
    const res = await app.inject({ method: 'POST', url: '/api/rgb/usdt/invoices', payload: { allowAnyAsset: true } })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().anyAsset, true)
    assert.equal(res.json().assetId, null)
    assert.equal((await app.inject({ method: 'POST', url: '/api/rgb/usdt/invoices', payload: { amountUsdt: '0.1', allowAnyAsset: true } })).statusCode, 400)
  } finally { await app.close() }
})
