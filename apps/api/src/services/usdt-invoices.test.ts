import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UsdtInvoiceService, type UsdtInvoiceNode } from './usdt-invoices.js'
import { MUTINYNET_USDT } from './usdt-capacity.js'

function fixture(overrides = {}) {
  const calls: unknown[] = []
  const node = { getNetworkInfo: async () => ({ network: 'SignetCustom' }),
    listChannels: async () => ({ channels: [{ asset_id: MUTINYNET_USDT, status: 'Opened', ready: true,
      is_usable: true, asset_remote_amount: 20000000, inbound_balance_msat: 3000000, ...overrides }] }),
    createLNInvoice: async (body: unknown) => { calls.push(body); return { invoice: 'ln-test' } },
  } as unknown as UsdtInvoiceNode
  return { service: new UsdtInvoiceService(node), calls, node }
}
test('USDT invoice uses exact units and explicit BTC carrier', async () => {
  const { service, calls } = fixture()
  const result = await service.createInvoice('1.000001', 'Sale')
  assert.equal(result.assetAmount, 1000001)
  assert.equal(result.carrierSat, 3000)
  assert.deepEqual(calls, [{ amt_msat: 3000000, expiry_sec: 300, asset_id: MUTINYNET_USDT, asset_amount: 1000001, description: 'Sale' }])
})
test('invalid amounts never create invoices', async () => {
  const { service, calls } = fixture()
  for (const amount of ['0', '-1', '1000.000001', '1.0000001', '1e1', 'NaN']) await assert.rejects(service.createInvoice(amount))
  assert.equal(calls.length, 0)
})
test('both capacities must exist on a ready usable USDT channel', async () => {
  for (const override of [{ asset_id: null }, { ready: false }, { is_usable: false }, { status: 'Opening' },
    { asset_remote_amount: 999999 }, { inbound_balance_msat: 2999999 }]) {
    const { service, calls } = fixture(override)
    await assert.rejects(service.createInvoice('1'))
    assert.equal(calls.length, 0)
  }
})
test('wrong network and node failures do not create invoices', async () => {
  const { service, node, calls } = fixture()
  node.getNetworkInfo = async () => ({ network: 'Bitcoin' }) as never
  await assert.rejects(service.createInvoice('1'))
  node.getNetworkInfo = async () => { throw Error('offline') }
  await assert.rejects(service.createInvoice('1'))
  assert.equal(calls.length, 0)
})
