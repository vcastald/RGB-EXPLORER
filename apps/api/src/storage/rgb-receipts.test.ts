import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RgbReceiptStore } from './rgb-receipts.js'
test('receipt intents survive reopening and are scoped to node', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rgb-receipts-'))
  try {
    const file = join(dir, 'test.sqlite')
    const first = new RgbReceiptStore(file)
    const receipt = { recipientId: 'r', nodePubkey: 'n', expectedAssetId: 'xaut', assetAmount: null, expirationTimestamp: 99 }
    first.save(receipt); first.close()
    const second = new RgbReceiptStore(file)
    assert.deepEqual(second.get('n', 'r'), receipt)
    assert.equal(second.get('other', 'r'), undefined)
    assert.throws(() => second.save(receipt))
    second.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
