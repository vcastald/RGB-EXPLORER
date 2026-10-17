import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from './app.js'

test('node status reports a responding node', async () => {
  const app = createApp({
    fetchNode: async () => Response.json({ pubkey: 'test-pubkey' }),
  })
  try {
    const response = await app.inject('/api/node/status')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { online: true, pubkey: 'test-pubkey' })
  } finally {
    await app.close()
  }
})

test('node status reports an unavailable node', async () => {
  const app = createApp({ fetchNode: async () => { throw new Error('Connection refused') } })
  try {
    const response = await app.inject('/api/node/status')
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { online: false })
  } finally {
    await app.close()
  }
})

test('health endpoint responds', async () => {
  const app = createApp()
  try {
    const response = await app.inject('/api/health')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { status: 'ok' })
  } finally {
    await app.close()
  }
})
