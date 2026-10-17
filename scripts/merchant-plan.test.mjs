import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makePlan } from './merchant-plan.mjs'

const input = {
  node: { network: 'SignetCustom', pubkey: 'our-node', spendable: 460000 },
  lsp: { lsp_connection_url: 'pubkey@host:9735', options: {
    min_channel_balance_sat: 50000, max_channel_balance_sat: 1000000,
    max_initial_lsp_balance_sat: 1000000, max_initial_client_balance_sat: 1000000,
  }, assets: [] },
  market: { network: 'signetcustom', assets: [{ ticker: 'BTC', is_active: true, supported_layers: ['BTC_LN'] }] },
  fees: [{ setup_fee: 1000, capacity_fee: 500, duration_fee: 432, total_fee: 2000 }],
}

test('plans only BTC Lightning without creating an order', () => {
  const result = makePlan(input)
  assert.deepEqual(result.channels.map((c) => c.ticker), ['BTC'])
  assert.equal(result.channels[0].assetId, null)
  assert.equal(result.totalEstimatedFeesSat, 2000)
  assert.equal(result.feeWarnings.length, 1)
})

test('rejects wrong network and missing BTC market support', () => {
  assert.throws(() => makePlan({ ...input, node: { ...input.node, network: 'Mainnet' } }), /Mutinynet/)
  assert.throws(() => makePlan({ ...input, market: { ...input.market, assets: [] } }), /BTC Lightning/)
})

test('warns when LSP fee total does not match breakdown', () => {
  const result = makePlan({ ...input, fees: [{ ...input.fees[0], total_fee: 3432 }] })
  assert.equal(result.feeWarnings.length, 1)
})
