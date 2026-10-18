import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteAddressStore } from './addresses.js'

test('persists addresses and isolates wallet identities', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rgb-address-test-'))
  const filename = join(dir, 'addresses.sqlite')
  const record = { address: 'tb1-test', nodePubkey: 'wallet-a', network: 'SignetCustom', createdAt: '2026-10-17T00:00:00Z' }
  try {
    const store = new SqliteAddressStore(filename)
    store.save(record)
    assert.deepEqual(store.list('wallet-b', 'SignetCustom'), [])
    assert.deepEqual(store.list('wallet-a', 'Regtest'), [])
    assert.throws(() => store.save(record)) // never overwrite a record silently
    store.close()
    const reopened = new SqliteAddressStore(filename)
    assert.deepEqual(reopened.list('wallet-a', 'SignetCustom'), [record])
    reopened.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
