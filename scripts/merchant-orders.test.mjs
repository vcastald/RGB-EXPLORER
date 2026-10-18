import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { nextChannel, readJournal, requireKnownOrder, saveJournal } from './merchant-orders.mjs'

test('first-run BTC, never create a second order even after completion', () => {
  assert.equal(nextChannel(null), 'BTC')
  const journal = { channels: { BTC: { state: 'SUBMISSION_UNKNOWN' } } }
  assert.equal(nextChannel(journal), null)
  assert.throws(() => requireKnownOrder(journal, 'BTC'), /do not retry/)
  journal.channels.BTC = { state: 'COMPLETED', orderId: 'id', accessToken: 'private' }
  assert.equal(nextChannel(journal), null)
  journal.channels.USDT = { state: 'FAILED', orderId: 'historical', accessToken: 'private' }
  assert.equal(nextChannel(journal), null)
})

test('journal persists identity and access token without silent overwrite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merchant-order-'))
  const file = join(dir, 'private', 'orders.json')
  try {
    const first = { nodePubkey: 'key', channels: { BTC: { state: 'SUBMISSION_UNKNOWN' } } }
    saveJournal(file, first, true)
    assert.throws(() => saveJournal(file, first, true), /EEXIST/)
    const updated = { nodePubkey: 'key', channels: { BTC: { state: 'CREATED', accessToken: 'private' } } }
    saveJournal(file, updated)
    assert.deepEqual(readJournal(file), updated)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
