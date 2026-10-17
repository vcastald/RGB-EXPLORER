import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paymentTerms } from './merchant-setup.mjs'

const journal = { nodePubkey: 'pub' }
const entry = { orderId: 'id', assetId: null }
const order = { order_id: 'id', client_pubkey: 'pub', asset_id: null, order_state: 'CREATED',
  payment: { onchain: { state: 'EXPECT_PAYMENT', address: 'tb1q' + 'a'.repeat(38), order_total_sat: 2000,
    expires_at: '2026-10-17T14:29:19.107000' } } }
const now = Date.parse('2026-10-17T14:20:00Z')
test('live terms require valid order and non-imminent UTC expiry', () => {
  assert.equal(paymentTerms(order, journal, entry, now).amount, 2000)
  assert.match(paymentTerms(order, journal, entry, now).expiry, /Z$/)
  assert.throws(() => paymentTerms(order, journal, entry, Date.parse('2026-10-17T14:28:00Z')), /expiry/)
  assert.throws(() => paymentTerms({ ...order, order_state: 'COMPLETED' }, journal, entry, now), /no longer/)
  assert.throws(() => paymentTerms(order, journal, { ...entry, paymentAttempt: { state: 'SUBMISSION_UNKNOWN' } }, now), /already attempted/)
  assert.throws(() => paymentTerms({ ...order, client_pubkey: 'other' }, journal, entry, now), /identity/)
})
