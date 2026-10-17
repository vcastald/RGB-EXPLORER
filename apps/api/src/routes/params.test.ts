import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { SqliteParamsStore } from '../storage/params.js'

test('params endpoint gets default target allocation and updates it via PUT/POST', async () => {
  const store = new SqliteParamsStore(':memory:')
  const app = createApp({ paramsStore: store })

  try {
    // 1. GET initial default
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/params/target-allocation',
    })
    assert.equal(getRes.statusCode, 200)
    const getData = getRes.json()
    assert.deepEqual(getData.target, { btc: 40, xaut: 30, usdt: 30 })
    assert.ok(getData.updatedAt)

    // 2. PUT update
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/params/target-allocation',
      payload: { btc: 50, xaut: 25, usdt: 25 },
    })
    assert.equal(putRes.statusCode, 200)
    const putData = putRes.json()
    assert.deepEqual(putData.target, { btc: 50, xaut: 25, usdt: 25 })

    // 3. GET after update to verify read from DB
    const getRes2 = await app.inject({
      method: 'GET',
      url: '/api/params/target-allocation',
    })
    assert.equal(getRes2.statusCode, 200)
    assert.deepEqual(getRes2.json().target, { btc: 50, xaut: 25, usdt: 25 })

    // 4. Invalid payload validation
    const badRes = await app.inject({
      method: 'PUT',
      url: '/api/params/target-allocation',
      payload: { btc: 150, xaut: -10, usdt: 0 },
    })
    assert.equal(badRes.statusCode, 400)
  } finally {
    await app.close()
    store.close()
  }
})
