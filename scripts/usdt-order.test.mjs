import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkedTerms, validateOrder, proposal, expectedUsdtId } from './usdt-order.mjs'

const address = 'tb1q' + 'a'.repeat(38)
const refund = 'tb1q' + 'b'.repeat(38)
const order = { order_id: 'order-id', access_token: 'secret', client_pubkey: 'seller',
  ...proposal, asset_id: expectedUsdtId, order_state: 'CREATED',
  payment: { onchain: { state: 'EXPECT_PAYMENT', address, order_total_sat: 24014,
    expires_at: '2026-10-17T18:30:00.123456Z', refund_onchain_address: refund } } }
const now = Date.parse('2026-10-17T18:20:00Z')

test('save exact order terms then accept equivalent timezone-less status ONLY against saved UTC time', () => {
  const saved = validateOrder(order, 'seller', refund)
  const journal = { nodePubkey: 'seller', order: saved }
  const status = { ...order, payment: { onchain: { ...order.payment.onchain, expires_at: '2026-10-17T18:30:00.123000' } } }
  assert.deepEqual(checkedTerms(status, journal, now), saved.terms)
  assert.throws(() => checkedTerms(status, journal, Date.parse('2026-10-17T18:29:00Z')), /too close/)
  assert.throws(() => checkedTerms(status, { ...journal, order: { ...saved, paymentAttempt: { state: 'SUBMISSION_UNKNOWN' } } }, now), /already attempted/)
})

test('rejects changed order, missing refund address, payment address or expiry', () => {
  const saved = validateOrder(order, 'seller', refund)
  const journal = { nodePubkey: 'seller', order: saved }
  assert.throws(() => validateOrder({ ...order, payment: { onchain: { ...order.payment.onchain, refund_onchain_address: null } } }, 'seller', refund), /mismatched/)
  assert.throws(() => checkedTerms({ ...order, lsp_asset_amount: 1 }, journal, now), /allocation/)
  assert.throws(() => checkedTerms({ ...order, payment: { onchain: { ...order.payment.onchain, address: refund } } }, journal, now), /address mismatch/)
  assert.throws(() => checkedTerms({ ...order, payment: { onchain: { ...order.payment.onchain, expires_at: '2026-10-17T19:30:00' } } }, journal, now), /expiry changed/)
  assert.throws(() => checkedTerms(order, { ...journal, order: { ...saved, terms: { ...saved.terms, expiresAt: '2026-10-17T18:30:00' } } }, now), /ambiguous/)
})

test('USDT defaults to successful provider and preserves distinct legacy journal', async () => {
  const { usdtProvider } = await import('./usdt-order.mjs')
  assert.deepEqual(usdtProvider(), { baseUrl: 'https://api.mutinynet2.kaleidoswap.com', journalName: 'usdt-order-mutinynet2' })
  assert.equal(usdtProvider('https://api.mutinynet2.kaleidoswap.com/').journalName, 'usdt-order-mutinynet2')
  assert.equal(usdtProvider('https://api.signet.kaleidoswap.com').journalName, 'usdt-order')
  assert.throws(() => usdtProvider('https://unknown.example'), /Unsupported USDT LSP/)
})
