import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RgbUsdtInvoiceService, DEFAULT_RGB_PROXY, type RgbInvoiceNode } from './rgb-usdt-invoices.js'
import { MUTINYNET_USDT } from './usdt-capacity.js'
function fixture() {
  const calls: unknown[] = []
  const node = { getNetworkInfo: async () => ({ network: 'SignetCustom' }),
    listAssets: async () => ({ nia: [{ asset_id: MUTINYNET_USDT, ticker: 'USDT', precision: 6 }] }),
    createRgbInvoice: async (body: unknown) => { calls.push(body); return { invoice: 'rgb:test', recipient_id: 'recipient', batch_transfer_idx: 42, expiration_timestamp: 4600 } },
  } as unknown as RgbInvoiceNode
  return { node, calls, service: new RgbUsdtInvoiceService(node, DEFAULT_RGB_PROXY, () => 1000000) }
}
test('amount-free USDT witness invoice uses configured proxy and one confirmation', async () => {
  const { calls, service } = fixture()
  const result = await service.createInvoice()
  assert.deepEqual(calls, [{ asset_id: MUTINYNET_USDT, assignment: null, witness: true,
    min_confirmations: 1, expiration_timestamp: 4600, transport_endpoints: [DEFAULT_RGB_PROXY] }])
  assert.equal(result.assetAmount, null)
  assert.equal(result.batchTransferIdx, 42)
})
test('exact amount uses integer fungible units; invalid amounts make no node invoice', async () => {
  const { calls, service } = fixture()
  for (const value of ['0', '-1', '0.0000001', '1000.000001', '1e2']) await assert.rejects(service.createInvoice(value))
  assert.equal(calls.length, 0)
  assert.equal((await service.createInvoice('0.100001')).assetAmount, 100001)
  assert.deepEqual((calls[0] as { assignment: unknown }).assignment, { type: 'Fungible', value: 100001 })
})
test('wrong network or unknown asset blocks invoice without generic fallback', async () => {
  const { calls, service, node } = fixture()
  node.listAssets = async () => ({ nia: [], uda: [], cfa: [], ifa: [] })
  await assert.rejects(service.createInvoice(), /not known/)
  node.getNetworkInfo = async () => ({ network: 'Bitcoin' }) as never
  await assert.rejects(service.createInvoice(), /Mutinynet/)
  assert.equal(calls.length, 0)
})

test('fresh USDT wallet supports explicit amount-free bootstrap only', async () => {
  const { service, calls, node } = fixture()
  node.listAssets = async () => ({ nia: [], uda: [], cfa: [], ifa: [] })
  await assert.rejects(service.createInvoice('0.1'), /not known/)
  await assert.rejects(service.createInvoice('0.1', true), /omit the amount/)
  assert.equal(calls.length, 0)
  const result = await service.createInvoice(undefined, true)
  assert.equal(result.anyAsset, true)
  assert.equal(result.assetId, null)
  assert.equal(result.expectedAssetId, MUTINYNET_USDT)
  assert.match(result.warning!, /any RGB asset/)
  assert.equal((calls[0] as { asset_id: unknown }).asset_id, null)
})
