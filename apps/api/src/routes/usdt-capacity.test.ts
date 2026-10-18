import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { UnsupportedUsdtProposal } from '../services/usdt-capacity.js'

test('capacity is independent of remote LSP; estimate validates input and returns safe timeout', async () => {
  const calls: number[] = []
  const capacity = { channels: [], usableInboundAssetUnits: 0 }
  const app = createApp({ usdtCapacityService: {
    getCapacity: async () => capacity as never,
    estimate: async (amount) => { calls.push(amount); throw Error('timeout') },
  } })
  try {
    assert.deepEqual((await app.inject('/api/lightning/usdt/capacity')).json(), capacity)
    assert.equal((await app.inject({ method: 'POST', url: '/api/lightning/usdt/estimate', payload: { additionalUsdt: 0 } })).statusCode, 400)
    assert.deepEqual(calls, [])
    const response = await app.inject({ method: 'POST', url: '/api/lightning/usdt/estimate', payload: { additionalUsdt: 20 } })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().stage, 'node')
    assert.equal(response.json().orderCreated, false)
    assert.deepEqual(calls, [20])
  } finally { await app.close() }
})

test('unsupported live limit is distinct from remote outage', async () => {
  const app = createApp({ usdtCapacityService: {
    getCapacity: async () => { throw Error('unused') },
    estimate: async () => { throw new UnsupportedUsdtProposal('outside live limits') },
  } })
  try {
    const response = await app.inject({ method: 'POST', url: '/api/lightning/usdt/estimate', payload: { additionalUsdt: 20 } })
    assert.equal(response.statusCode, 422)
    assert.deepEqual(response.json(), { error: 'outside live limits' })
  } finally { await app.close() }
})
