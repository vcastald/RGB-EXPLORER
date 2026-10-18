// Mutinynet-only, one-order USDT receiving setup. Does not run unless invoked explicitly.
import { KaleidoClient } from 'kaleido-sdk'
import { existsSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { proposal, expectedUsdtId, checkedTerms, validateOrder, usdtProvider } from './usdt-order.mjs'
import { readJournal, saveJournal } from './merchant-orders.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const env = resolve(root, '.env')
if (existsSync(env)) loadEnvFile(env)
const { baseUrl, journalName } = usdtProvider(process.env.USDT_LSP_URL)
const file = resolve(root, `.local-app/${journalName}.json`)
const lock = resolve(root, `.local-app/${journalName}.lock`)
const nodeUrl = process.env.RGB_NODE_URL ?? `http://127.0.0.1:${process.env.RGB_NODE_PORT ?? '3901'}`
const statusOnly = process.argv[2] === '--status'

async function confirm(phrase) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw Error('Interactive terminal required for order/payment')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try { return (await rl.question(`Type ${phrase} to confirm, or Enter to cancel: `)) === phrase }
  finally { rl.close() }
}

async function observe(client, record) {
  if (!record.order?.orderId || !record.order?.accessToken) {
    console.log('Order submission may have succeeded but no response was saved. STOP: reconcile with LSP; never retry automatically.')
    return
  }
  const entry = record.order
  const order = await client.maker.getLspOrder({ order_id: entry.orderId, access_token: entry.accessToken })
  if (order.order_id !== entry.orderId || order.client_pubkey !== record.nodePubkey || order.asset_id !== expectedUsdtId) {
    throw Error('Unexpected order identity; stop and investigate')
  }
  entry.state = order.order_state
  saveJournal(file, record)
  const channels = await client.rln.listChannels()
  const rgb = channels.channels.filter((ch) => ch.asset_id === expectedUsdtId)
    .map((ch) => ({ channelId: ch.channel_id, peerPubkey: ch.peer_pubkey, status: ch.status,
      ready: ch.ready, usable: ch.is_usable, remoteAssetUnits: ch.asset_remote_amount,
      inboundMsat: ch.inbound_balance_msat }))
  const matched = rgb.find((ch) => ch.channelId === order.channel?.channel_id && ch.peerPubkey === record.lspPubkey)
  const receiveReady = !!matched && order.order_state === 'COMPLETED' && matched.status === 'Opened' &&
    matched.ready && matched.usable && matched.remoteAssetUnits >= 1000000 && matched.inboundMsat >= 3000000
  console.log(JSON.stringify({ orderId: entry.orderId, state: order.order_state,
    paymentState: order.payment.onchain.state, failureReason: order.failure_reason ?? null,
    channelId: order.channel?.channel_id ?? null, receiveReady, nodeUsdtChannels: rgb,
    paymentAttempt: entry.paymentAttempt?.state ?? null,
    note: 'Status only. PAID is not usable; require order/channel match and node ready + usable. FAILED/TO_REFUND needs refund follow-up.' }, null, 2))
  return order
}

async function create(client, record, nodePubkey) {
  const [info, listed] = await Promise.all([
    client.maker.getLspInfo(), client.rln.listChannels(),
  ])
  if (listed.channels.some((ch) => ch.asset_id === expectedUsdtId && ch.is_usable)) throw Error('Usable USDT channel already exists; review capacity before ordering')
  const asset = info.assets.find((entry) => entry.asset_id === expectedUsdtId && entry.ticker === 'USDT' && entry.precision === 6)
  const opts = info.options
  if (!asset || proposal.lsp_asset_amount < asset.min_initial_lsp_amount || proposal.lsp_asset_amount > asset.max_initial_lsp_amount ||
      proposal.lsp_asset_amount < asset.min_channel_amount || proposal.lsp_asset_amount > asset.max_channel_amount ||
      proposal.client_asset_amount < asset.min_initial_client_amount || proposal.client_asset_amount > asset.max_initial_client_amount ||
      proposal.lsp_balance_sat + proposal.client_balance_sat < opts.min_channel_balance_sat ||
      proposal.lsp_balance_sat + proposal.client_balance_sat > opts.max_channel_balance_sat ||
      proposal.lsp_balance_sat < opts.min_initial_lsp_balance_sat || proposal.lsp_balance_sat > opts.max_initial_lsp_balance_sat ||
      proposal.client_balance_sat < opts.min_initial_client_balance_sat || proposal.client_balance_sat > opts.max_initial_client_balance_sat ||
      proposal.channel_expiry_blocks > opts.max_channel_expiry_blocks ||
      proposal.required_channel_confirmations < opts.min_required_channel_confirmations ||
      proposal.funding_confirms_within_blocks < Math.max(1, opts.min_funding_confirms_within_blocks)) {
    throw Error('Proposed channel outside live LSP limits')
  }
  const fees = await client.maker.estimateLspFees({ lsp_balance_sat: proposal.lsp_balance_sat,
    client_balance_sat: proposal.client_balance_sat, channel_expiry_blocks: proposal.channel_expiry_blocks,
    asset_id: asset.asset_id, lsp_asset_amount: proposal.lsp_asset_amount, client_asset_amount: 0 })
  const balance = await client.rln.getBtcBalance(false)
  if (!Number.isSafeInteger(fees.total_fee) || fees.total_fee < 0 ||
      balance.vanilla.spendable < proposal.client_balance_sat + fees.total_fee + 2000) {
    throw Error('Invalid fee estimate or insufficient spendable test BTC with payment fee reserve')
  }
  const historical = readJournal(resolve(root, '.local-app/merchant-orders.json'))?.channels?.USDT
  console.log(JSON.stringify({ proposed: { ...proposal, asset_id: expectedUsdtId },
    estimatedFeeSat: fees.total_fee, illustrativeSubtotalSat: proposal.client_balance_sat + fees.total_fee,
    provider: baseUrl,
    onchainSpendableSat: balance.vanilla.spendable,
    historicalUsdtOrder: historical ? { orderId: historical.orderId ?? null, state: historical.state,
      warning: 'Separate historical order; refund may still be outstanding. This command cannot recover it.' } : null,
    note: 'Creating a NEW order contacts the LSP; this estimate is NOT the final payment total. No funds will be sent in this run. A fresh refund address will be derived only after confirmation.' }, null, 2))
  if (!await confirm('CREATE USDT ORDER')) return console.log('Cancelled; no order created.')
  const lspPubkey = info.lsp_connection_url.split('@')[0]
  if (!(await client.rln.listPeers()).peers.some((peer) => peer.pubkey === lspPubkey)) {
    await client.rln.connectPeer({ peer_pubkey_and_addr: info.lsp_connection_url })
  }
  const refundAddress = (await client.rln.getAddress()).address
  if (!/^tb1[ac-hj-np-z02-9]{20,}$/i.test(refundAddress)) throw Error('Unexpected refund address; order not created')
  const request = { client_pubkey: nodePubkey, ...proposal, asset_id: expectedUsdtId,
    refund_onchain_address: refundAddress }
  record.lspPubkey = lspPubkey
  record.order = { state: 'SUBMISSION_UNKNOWN', request, refundAddress, submittedAt: new Date().toISOString() }
  saveJournal(file, record, true) // intent BEFORE non-idempotent create; never overwrite an existing order
  const order = await client.maker.createLspOrder(request)
  record.order = { ...record.order, ...validateOrder(order, nodePubkey, refundAddress) }
  saveJournal(file, record)
  console.log(JSON.stringify({ orderId: record.order.orderId, state: order.order_state,
    finalOnchainTotalSat: record.order.terms.amountSat, onchainExpiresAt: record.order.terms.expiresAt,
    note: 'Order saved, NOT paid. Run npm run usdt:setup again to review live terms and separately approve payment.' }, null, 2))
}

async function pay(client, record, order) {
  if (!order || record.order.paymentAttempt || order.order_state !== 'CREATED' || order.payment?.onchain?.state !== 'EXPECT_PAYMENT') return
  const terms = checkedTerms(order, record)
  const btc = await client.rln.getBtcBalance(false)
  if (btc.vanilla.spendable < terms.amountSat + 2000) throw Error('Insufficient spendable test BTC with fee reserve')
  console.log(JSON.stringify({ orderId: record.order.orderId, onchainAddress: terms.address,
    onchainPaymentSat: terms.amountSat, expiresAtUtc: terms.expiresAt, feeRateSatPerVbyte: 2,
    warning: 'On-chain miner fee is additional and not independently capped. This spends Mutinynet test BTC. Approval is for this exact order; do not retry on timeout.' }, null, 2))
  if (!await confirm(`PAY USDT ${terms.amountSat}`)) return console.log('Cancelled; no payment sent.')
  const fresh = await client.maker.getLspOrder({ order_id: record.order.orderId, access_token: record.order.accessToken })
  checkedTerms(fresh, record) // abort on changed state, identity, refund address, expiry or amount
  record.order.paymentAttempt = { state: 'SUBMISSION_UNKNOWN', at: new Date().toISOString(),
    amountSat: terms.amountSat, address: terms.address, feeRateSatPerVbyte: 2 }
  saveJournal(file, record) // persist before sending; a timeout can mean successful broadcast
  const sent = await client.rln.sendBtc({ address: terms.address, amount: terms.amountSat, fee_rate: 2, skip_sync: false })
  if (!/^[0-9a-f]{64}$/i.test(sent.txid)) throw Error('Unexpected txid; may already have broadcast. Do not retry.')
  record.order.paymentAttempt = { ...record.order.paymentAttempt, state: 'BROADCAST', txid: sent.txid }
  saveJournal(file, record)
  console.log(JSON.stringify({ txid: sent.txid, paidSat: terms.amountSat,
    note: 'Broadcast submitted, not yet a usable channel. Run npm run usdt:setup -- --status to track.' }, null, 2))
}

async function main() {
  if (process.argv[2] && !statusOnly) throw Error('Usage: npm run usdt:setup [-- --status]')
  mkdirSync(resolve(root, '.local-app'), { recursive: true, mode: 0o700 })
  const fd = openSync(lock, 'wx', 0o600)
  const client = KaleidoClient.create({ nodeUrl, baseUrl, timeout: 30 })
  try {
    const network = await client.rln.getNetworkInfo()
    const node = await client.rln.getNodeInfo()
    if (network.network.toLowerCase() !== 'signetcustom') throw Error('Mutinynet node required')
    const record = readJournal(file)
    if (record && (record.nodePubkey !== node.pubkey || record.network !== network.network || record.baseUrl !== baseUrl)) {
      throw Error('Saved order belongs to another node/network/LSP; do not retry')
    }
    if (!record) {
      if (statusOnly) return console.log('No USDT order recorded by this workflow. Historical failed order is stored separately.')
      return await create(client, { nodePubkey: node.pubkey, network: network.network, baseUrl }, node.pubkey)
    }
    const order = await observe(client, record)
    if (!statusOnly) await pay(client, record, order)
  } finally { await client.close(); closeSync(fd); unlinkSync(lock) }
}

main().catch((error) => { console.error(`USDT setup stopped: ${error.message}`); process.exitCode = 1 })
