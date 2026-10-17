// Non-spending Mutinynet preflight. This script never creates orders, channels, invoices or payments.
import { KaleidoClient } from 'kaleido-sdk'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) loadEnvFile(envFile)

export const config = {
  lspBalanceSat: 50000,
  clientBalanceSat: 0,
  expiryBlocks: 4320,
}

export function makePlan({ node, lsp, market, fees, settings = config }) {
  if (node.network.toLowerCase() !== 'signetcustom' || market.network.toLowerCase() !== 'signetcustom') {
    throw new Error('Node and market must both be Mutinynet (SignetCustom)')
  }
  const capacitySat = settings.lspBalanceSat + settings.clientBalanceSat
  const limits = lsp.options
  if (capacitySat < limits.min_channel_balance_sat || capacitySat > limits.max_channel_balance_sat ||
      settings.lspBalanceSat > limits.max_initial_lsp_balance_sat || settings.clientBalanceSat > limits.max_initial_client_balance_sat) {
    throw new Error('Requested channel balances are outside live LSP limits')
  }
  if (!market.assets.some((asset) => asset.ticker === 'BTC' && asset.is_active && asset.supported_layers.includes('BTC_LN'))) {
    throw new Error('Market does not advertise BTC Lightning')
  }
  if (fees.length !== 1) throw new Error('Expected one BTC fee estimate')
  const assets = [{ ticker: 'BTC', assetId: null, precision: 8, lspAssetAmount: null,
    clientAssetAmount: null, lspBalanceSat: settings.lspBalanceSat, clientBalanceSat: settings.clientBalanceSat,
    channelExpiryBlocks: settings.expiryBlocks, feeEstimateSat: fees[0].total_fee, feeBreakdown: fees[0] }]
  return { network: 'SignetCustom', nodePubkey: node.pubkey, onchainSpendableSat: node.spendable,
    lspConnectionUrl: lsp.lsp_connection_url, channels: assets,
    totalEstimatedFeesSat: fees.reduce((sum, fee) => sum + fee.total_fee, 0),
    feeWarnings: fees.flatMap((fee, i) => fee.total_fee !== fee.setup_fee + fee.capacity_fee + fee.duration_fee - (fee.applied_discount ?? 0)
      ? [`${assets[i].ticker}: LSP total_fee differs from the sum of its listed components; confirm before payment`] : []),
    note: 'BTC Lightning only. Fee estimate, NOT the order payment total. No order placed. Verify node channel readiness and test a small invoice after opening.' }
}

async function main() {
  const client = KaleidoClient.create({
    nodeUrl: process.env.RGB_NODE_URL ?? `http://127.0.0.1:${process.env.RGB_NODE_PORT ?? '3901'}`,
    baseUrl: process.env.KALEIDO_API_URL ?? 'https://api.signet.kaleidoswap.com', timeout: 30,
  })
  try {
    const [network, info, balance, lsp, market] = await Promise.all([
      client.rln.getNetworkInfo(), client.rln.getNodeInfo(), client.rln.getBtcBalance(false),
      client.maker.getLspInfo(), client.maker.listAssets(),
    ])
    if (network.network.toLowerCase() !== 'signetcustom' || market.network.toLowerCase() !== 'signetcustom') throw Error('Mutinynet required')
    const baseOrder = { lsp_balance_sat: config.lspBalanceSat, client_balance_sat: config.clientBalanceSat, channel_expiry_blocks: config.expiryBlocks }
    const fees = [await client.maker.estimateLspFees(baseOrder)]
    console.log(JSON.stringify(makePlan({node: {network: network.network, pubkey: info.pubkey, spendable: balance.vanilla.spendable}, lsp, market, fees}), null, 2))
  } finally { await client.close() }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { console.error(`Merchant preflight failed: ${error.message}`); process.exitCode = 1 })
}
