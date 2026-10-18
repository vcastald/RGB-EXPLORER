import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
test('status route validates recipients and distinguishes missing and unavailable', async () => {
  const app = createApp({ rgbReceivingService: { refreshNow: async () => ({ refreshed: true, refreshedAt: 'test' }), status: async id => {
    if (id === 'offline') throw Error('offline')
    return null
  } } })
  try {
    assert.equal((await app.inject('/api/rgb/transfers/status')).statusCode, 400)
    assert.equal((await app.inject('/api/rgb/transfers/status?recipientId=unknown')).statusCode, 404)
    assert.equal((await app.inject('/api/rgb/transfers/status?recipientId=offline')).statusCode, 503)
  } finally { await app.close() }
})


test('manual refresh returns completion or 503, never payment success', async () => {
  for (const fail of [false, true]) {
    let calls = 0
    const app = createApp({ rgbReceivingService: {
      status: async () => null,
      refreshNow: async () => {
        calls++
        if (fail) throw Error('timeout')
        return { refreshed: true, refreshedAt: '2026-10-18T10:00:00Z' }
      },
    } })
    try {
      const response = await app.inject({ method: 'POST', url: '/api/rgb/transfers/refresh' })
      assert.equal(response.statusCode, fail ? 503 : 200)
      assert.equal(calls, 1)
      assert.equal(response.json().paid, undefined)
      if (!fail) assert.equal(response.json().refreshed, true)
    } finally { await app.close() }
  }
})
