import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { BitcoinNetwork } from 'kaleido-sdk/rln'
import type { LightningReadinessService } from '../services/lightning.js'

test('readiness route returns service snapshot', async () => {
  const snapshot = { observedAt: '2026-10-17T12:00:00Z', network: BitcoinNetwork.SignetCustom, pubkey: 'node', onchainSpendableSat: 0, connectedPeers: [], channels: [], hasUsableOutbound: false } satisfies Awaited<ReturnType<LightningReadinessService['getReadiness']>>
  const app = createApp({ lightningService: { getReadiness: async () => snapshot } })
  try {
    const response = await app.inject('/api/lightning/readiness')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), snapshot)
  } finally { await app.close() }
})

test('readiness route returns 503 on node failure', async () => {
  const app = createApp({ lightningService: { getReadiness: async () => { throw Error('node offline') } } })
  try {
    const response = await app.inject('/api/lightning/readiness')
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { error: 'Node unavailable' })
  } finally { await app.close() }
})
