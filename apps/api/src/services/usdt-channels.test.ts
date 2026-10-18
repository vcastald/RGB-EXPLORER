import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { UsdtChannels, validateChannelInput } from './usdt-channels.js'
import { registerUsdtChannelRoutes } from '../routes/usdt-channels.js'
import { MUTINYNET_USDT } from './usdt-capacity.js'
const input = { inboundUsdt: '20', clientBalanceSat: 20000, maxOrderPaymentSat: 25000, acceptUncappedMinerFee: true }
const provider = 'https://api.mutinynet2.kaleidoswap.com'
function fixture(fail?: 'create' | 'pay' | 'cap' | 'changed' | 'limits') {
  const dir = mkdtempSync(join(tmpdir(), 'usdt-provision-'))
  let creates = 0, pays = 0, complete = false
  let order: Record<string, any>
  const address = 'tb1q' + 'a'.repeat(40)
  const client = {
    rln: {
      getNodeInfo: async () => ({ pubkey: 'node' }), getNetworkInfo: async () => ({ network: 'SignetCustom' }),
      getBtcBalance: async () => ({ vanilla: { spendable: 150000 } }),
      listChannels: async () => ({ channels: complete ? [{ channel_id: 'channel', peer_pubkey: 'peer', asset_id: MUTINYNET_USDT, status: 'Opened', ready: true, is_usable: true, asset_remote_amount: 20000000, inbound_balance_msat: 48340000 }] : [] }),
      connectPeer: async () => ({}), getAddress: async () => ({ address }),
      sendBtc: async () => { pays++; if (fail === 'pay') throw Error('secret upstream payment error'); return { txid: 'a'.repeat(64) } },
    },
    maker: {
      getLspNetworkInfo: async () => ({ network: 'signetcustom' }),
      getLspInfo: async () => ({ lsp_connection_url: 'peer@host:9740', assets: [{ asset_id: MUTINYNET_USDT, ticker: 'USDT', precision: 6, min_initial_lsp_amount: 0, max_initial_lsp_amount: fail === 'limits' ? 1 : 1000000000, min_channel_amount: 0, max_channel_amount: 1000000000, min_initial_client_amount: 0, max_initial_client_amount: 1000000000 }], options: { min_initial_lsp_balance_sat: 0, max_initial_lsp_balance_sat: 1000000, min_initial_client_balance_sat: 0, max_initial_client_balance_sat: 1000000, min_channel_balance_sat: 50000, max_channel_balance_sat: 1000000, max_channel_expiry_blocks: 30000, min_required_channel_confirmations: 0, min_funding_confirms_within_blocks: 0 } }),
      estimateLspFees: async () => ({ total_fee: 4014 }),
      createLspOrder: async (request: Record<string, unknown>) => {
        creates++; if (fail === 'create') throw Error('secret upstream token')
        order = { ...request, order_id: 'order', access_token: 'SECRET_TOKEN', order_state: 'CREATED', payment: { onchain: { state: 'EXPECT_PAYMENT', address, order_total_sat: fail === 'cap' ? 99999 : 24014, refund_onchain_address: address, expires_at: new Date(Date.now() + 3600000).toISOString() } } }; return order
      },
      getLspOrder: async () => ({ ...order, order_state: complete ? 'COMPLETED' : 'CREATED', channel: { channel_id: 'channel' }, ...(fail === 'changed' ? { client_balance_sat: 1 } : {}) }),
    },
  }
  const service = new UsdtChannels(client as unknown as ConstructorParameters<typeof UsdtChannels>[0], dir, provider)
  return { dir, client, service, counts: () => ({ creates, pays }), complete: () => { complete = true }, cleanup: async () => { await service.close(); rmSync(dir, { recursive: true, force: true }) } }
}
test('successful operation pays once, redacts credentials, waits for matched usable channel', async () => {
  const f = fixture(); try {
    const op = f.service.create('unique-key', input)
    assert.equal(op.state, 'QUEUED')
    assert.equal(f.service.create('unique-key', input).operationId, op.operationId)
    assert.throws(() => f.service.create('unique-key', { ...input, inboundUsdt: '21' }), /different/)
    assert.throws(() => f.service.create('other-key', input), /Another/)
    await f.service.idle(); assert.equal(f.service.get(op.operationId).state, 'OPENING')
    assert.deepEqual(f.counts(), { creates: 1, pays: 1 })
    assert(!JSON.stringify(f.service.get(op.operationId)).includes('SECRET'))
    await f.service.poll(); assert.equal(f.service.get(op.operationId).receiveReady, false)
    f.complete(); await f.service.poll(); assert.equal(f.service.get(op.operationId).receiveReady, true)
    assert(!existsSync(join(f.dir, 'usdt-order-mutinynet2.lock')))
  } finally { await f.cleanup() }
})
for (const failure of ['create', 'pay', 'cap', 'changed', 'limits'] as const) test(`fails closed: ${failure}`, async () => {
  const f = fixture(failure); try {
    const op = f.service.create('unique-key', input); await f.service.idle()
    const result = f.service.get(op.operationId)
    assert.equal(result.state, failure === 'limits' ? 'REJECTED' : failure === 'pay' ? 'PAYMENT_UNKNOWN' : 'ORDER_UNKNOWN')
    assert.equal(f.counts().pays, failure === 'pay' ? 1 : 0)
    assert(!JSON.stringify(result).includes('secret'))
    f.service.create('unique-key', input); await f.service.idle()
    assert.equal(f.counts().creates, failure === 'limits' ? 0 : 1)
  } finally { await f.cleanup() }
})
test('restart does not retry an uncertain payment', async () => {
  const f = fixture('pay'); const op = f.service.create('unique-key', input); await f.service.idle(); await f.service.close()
  const restarted = new UsdtChannels(f.client as unknown as ConstructorParameters<typeof UsdtChannels>[0], f.dir, provider)
  try { assert.equal(restarted.create('unique-key', input).state, 'REVIEW_REQUIRED'); await restarted.poll(); assert.deepEqual(f.counts(), { creates: 1, pays: 1 }); assert.equal(restarted.get(op.operationId).receiveReady, false) }
  finally { await restarted.close(); rmSync(f.dir, { recursive: true, force: true }) }
})
test('CLI journal blocks provisioning without overwriting it', async () => {
  const f = fixture(); try { writeFileSync(join(f.dir, 'usdt-order-mutinynet2.json'), '{"private":"saved"}'); const op = f.service.create('unique-key', input); await f.service.idle(); assert.equal(f.service.get(op.operationId).state, 'REJECTED'); assert.deepEqual(f.counts(), { creates: 0, pays: 0 }) } finally { await f.cleanup() }
})
test('requires explicit miner fee consent and strict input', () => {
  assert.throws(() => validateChannelInput({ ...input, acceptUncappedMinerFee: false }))
  assert.throws(() => validateChannelInput({ ...input, inboundUsdt: '1e9' }))
  assert.throws(() => validateChannelInput({ ...input, provider: 'evil' }))
})
test('authenticated routes and disabled default', async () => {
  const f = fixture(); const app = Fastify(); registerUsdtChannelRoutes(app, f.service, 'x'.repeat(32))
  try {
    assert.equal((await app.inject({ method: 'POST', url: '/api/lightning/usdt/channels', payload: input })).statusCode, 401)
    assert.deepEqual(f.counts(), { creates: 0, pays: 0 })
    const headers = { authorization: 'Bearer ' + 'x'.repeat(32), 'idempotency-key': 'unique-key' }
    const response = await app.inject({ method: 'POST', url: '/api/lightning/usdt/channels', headers, payload: input })
    assert.equal(response.statusCode, 202)
    assert.equal((await app.inject({ url: response.headers.location as string })).statusCode, 401)
    assert.equal((await app.inject({ url: response.headers.location as string, headers })).statusCode, 200)
  } finally { await app.close(); await f.cleanup() }
  const disabled = Fastify(); registerUsdtChannelRoutes(disabled)
  try { assert.equal((await disabled.inject({ method: 'POST', url: '/api/lightning/usdt/channels', payload: input })).statusCode, 503) } finally { await disabled.close() }
})
test('restart while opening resumes observation only', async () => {
  const f = fixture(); const op = f.service.create('unique-key', input); await f.service.idle(); await f.service.close()
  const restarted = new UsdtChannels(f.client as unknown as ConstructorParameters<typeof UsdtChannels>[0], f.dir, provider)
  try { f.complete(); await restarted.poll(); assert.equal(restarted.get(op.operationId).state, 'READY'); assert.deepEqual(f.counts(), { creates: 1, pays: 1 }) }
  finally { await restarted.close(); rmSync(f.dir, { recursive: true, force: true }) }
})
test('CLI lock blocks submission without removing the lock', async () => {
  const f = fixture(); try { writeFileSync(join(f.dir, 'usdt-order.lock'), 'cli-owner'); assert.throws(() => f.service.create('unique-key', input), /CLI/); assert(existsSync(join(f.dir, 'usdt-order.lock'))); assert.deepEqual(f.counts(), { creates: 0, pays: 0 }) } finally { await f.cleanup() }
})
test('persistence failure before dispatch halts spender and retains exclusion locks', async () => {
  const f = fixture(); try {
    const internal = f.service as unknown as { save: () => void }
    internal.save = () => { throw Error('disk full') }
    f.service.create('unique-key', input); await f.service.idle()
    assert.deepEqual(f.counts(), { creates: 0, pays: 0 })
    assert(existsSync(join(f.dir, 'usdt-order-mutinynet2.lock')))
    assert.throws(() => f.service.create('another-key', input), /persistence/)
  } finally { await f.cleanup() }
})
