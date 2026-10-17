import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteParamsStore } from './params.js'

test('initializes default target allocation and persists updates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rgb-params-test-'))
  const filename = join(dir, 'params.sqlite')

  try {
    const store = new SqliteParamsStore(filename)
    const initial = store.getTargetAllocation()
    assert.equal(initial.btc, 40)
    assert.equal(initial.xaut, 30)
    assert.equal(initial.usdt, 30)
    assert.ok(initial.updatedAt)

    const updated = store.setTargetAllocation({ btc: 60, xaut: 20, usdt: 20 })
    assert.equal(updated.btc, 60)
    assert.equal(updated.xaut, 20)
    assert.equal(updated.usdt, 20)

    store.close()

    // Reopen and verify persistence
    const reopened = new SqliteParamsStore(filename)
    const loaded = reopened.getTargetAllocation()
    assert.equal(loaded.btc, 60)
    assert.equal(loaded.xaut, 20)
    assert.equal(loaded.usdt, 20)
    reopened.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
