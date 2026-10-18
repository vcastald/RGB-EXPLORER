import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RgbXautInvoiceService } from './rgb-xaut-invoices.js'
import { RGB_XAUT, type RgbInvoiceNode } from './rgb-usdt-invoices.js'
function fixture(known = true) {
  const calls: Record<string, unknown>[] = []
  const node = { getNetworkInfo: async () => ({ network: 'SignetCustom' }),
    listAssets: async () => ({ nia: known ? [{ asset_id: RGB_XAUT.id, ticker: 'XAUT', precision: 9 }] : [] }),
    createRgbInvoice: async (body: Record<string, unknown>) => { calls.push(body); return { invoice: 'rgb:test', recipient_id: 'recipient', batch_transfer_idx: 2, expiration_timestamp: 4600 } },
  } as unknown as RgbInvoiceNode
  return { calls, node, service: new RgbXautInvoiceService(node) }
}
test('XAUT uses nine decimal units and its own contract', async () => {
  const { service, calls } = fixture()
  const result = await service.createInvoice('0.000000001')
  assert.equal(result.assetAmount, 1)
  assert.equal(result.assetId, RGB_XAUT.id)
  assert.equal(result.assetPrecision, 9)
  assert.equal(result.amountXaut, '0.000000001')
  assert.equal('amountUsdt' in result, false)
  assert.deepEqual(calls[0].assignment, { type: 'Fungible', value: 1 })
  assert.equal(calls[0].witness, true)
})
test('unknown XAUT requires explicit generic bootstrap and rejects amounts', async () => {
  const { service, calls } = fixture(false)
  await assert.rejects(service.createInvoice(), /not known/)
  await assert.rejects(service.createInvoice('0.1', true), /omit the amount/)
  assert.equal(calls.length, 0)
  const result = await service.createInvoice(undefined, true)
  assert.equal(result.anyAsset, true)
  assert.equal(result.assetId, null)
  assert.equal(result.expectedAssetId, RGB_XAUT.id)
  assert.match(result.warning!, /any RGB asset/)
  assert.equal(calls[0].asset_id, null)
  assert.equal(calls[0].assignment, null)
})
test('known XAUT remains asset-specific even with bootstrap permission', async () => {
  const { service } = fixture()
  assert.equal((await service.createInvoice(undefined, true)).anyAsset, false)
})
test('invalid amounts and wrong network cannot create XAUT invoices', async () => {
  const { service, calls, node } = fixture()
  for (const amount of ['0', '-1', '0.0000000001', '1e2', '1000.000000001']) await assert.rejects(service.createInvoice(amount))
  node.getNetworkInfo = async () => ({ network: 'Bitcoin' }) as never
  await assert.rejects(service.createInvoice('0.1'), /Mutinynet/)
  assert.equal(calls.length, 0)
})
