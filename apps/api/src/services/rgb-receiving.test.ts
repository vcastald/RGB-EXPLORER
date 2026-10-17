import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RgbReceivingService, type ReceivingNode } from './rgb-receiving.js'
import { RgbReceiptStore } from '../storage/rgb-receipts.js'
function fixture() {
  const store = new RgbReceiptStore(':memory:')
  let refreshes = 0
  const transfer = { idx: 7, recipient_id: 'recipient', kind: 'ReceiveWitness', status: 'WaitingCounterparty', txid: null,
    assignments: [{ type: 'Fungible', value: 100000 }] }
  const node = { getNetworkInfo: async () => ({ network: 'SignetCustom' }), getNodeInfo: async () => ({ pubkey: 'node' }),
    listTransfers: async () => ({ transfers: [transfer] }), listAssets: async () => ({ nia: [{ asset_id: 'usdt' }] }),
    refreshTransfers: async () => { refreshes++ },
  } as unknown as ReceivingNode
  const service = new RgbReceivingService(node, store)
  return { service, node, store, transfer, refreshes: () => refreshes }
}
const invoice = { recipientId: 'recipient', expectedAssetId: 'usdt', assetAmount: 100000, expirationTimestamp: 9999999999 }
test('paid requires persisted intent, settled transfer, exact asset and amount', async () => {
  const f = fixture()
  try {
    await f.service.track(async () => invoice)
    assert.equal((await f.service.status('recipient'))?.paid, false)
    f.transfer.status = 'Settled'
    assert.equal((await f.service.status('recipient'))?.paid, true)
    f.transfer.assignments[0].value = 90000
    assert.equal((await f.service.status('recipient'))?.paid, false)
    f.transfer.assignments[0].value = 100000
    f.node.listAssets = async () => ({ nia: [{ asset_id: 'other' }] }) as never
    const wrongAsset = await f.service.status('recipient')
    assert.equal(wrongAsset?.actualAssetId, 'other')
    assert.equal(wrongAsset?.paid, false)
  } finally { await f.service.stop(); f.store.close() }
})
test('unknown asset bootstrap refreshes without asset restriction and untracked settlement is not paid', async () => {
  const f = fixture()
  try {
    f.node.listAssets = async () => ({ nia: [] }) as never
    let request: unknown
    f.node.refreshTransfers = async body => { request = body }
    await f.service.tick()
    assert.deepEqual(request, { filter: [], skip_sync: false })
    f.transfer.status = 'Settled'
    assert.equal((await f.service.status('recipient'))?.tracked, false)
    assert.equal((await f.service.status('recipient'))?.paid, false)
    await f.service.tick() // no refresh needed for settled transfers
  } finally { await f.service.stop(); f.store.close() }
})
test('single-flight refresh, error recovery and stop waits for in-flight refresh', async () => {
  const f = fixture()
  try {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let calls = 0
    f.node.refreshTransfers = async () => { calls++; await gate }
    const first = f.service.tick(), second = f.service.tick()
    assert.equal(first, second)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(calls, 1)
    let stopped = false
    const stopping = f.service.stop().then(() => { stopped = true })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(stopped, false)
    release(); await stopping
    f.node.refreshTransfers = async () => { throw Error('offline') }
    await f.service.tick()
    assert.equal((await f.service.status('recipient'))?.refreshError, 'RGB refresh unavailable')
    f.node.refreshTransfers = async () => {}
    await f.service.tick()
    assert.equal((await f.service.status('recipient'))?.refreshError, null)
  } finally { await f.service.stop(); f.store.close() }
})
test('wrong node identity cannot reuse intent; wrong network never refreshes', async () => {
  const f = fixture()
  try {
    await f.service.track(async () => invoice)
    f.node.getNodeInfo = async () => ({ pubkey: 'different' }) as never
    f.transfer.status = 'Settled'
    assert.equal((await f.service.status('recipient'))?.tracked, false)
    f.node.getNetworkInfo = async () => ({ network: 'Bitcoin' }) as never
    await f.service.tick()
    assert.equal(f.refreshes(), 0)
    await assert.rejects(f.service.status('recipient'), /Mutinynet/)
  } finally { await f.service.stop(); f.store.close() }
})
