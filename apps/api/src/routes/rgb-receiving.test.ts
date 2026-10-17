import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
test('status route validates recipients and distinguishes missing and unavailable', async () => {
  const app = createApp({ rgbReceivingService: { status: async id => {
    if (id === 'offline') throw Error('offline')
    return null
  } } })
  try {
    assert.equal((await app.inject('/api/rgb/transfers/status')).statusCode, 400)
    assert.equal((await app.inject('/api/rgb/transfers/status?recipientId=unknown')).statusCode, 404)
    assert.equal((await app.inject('/api/rgb/transfers/status?recipientId=offline')).statusCode, 503)
  } finally { await app.close() }
})
