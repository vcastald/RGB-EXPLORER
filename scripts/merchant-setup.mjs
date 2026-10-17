// Guided order creation ONLY. Never pays an order or starts a replacement after an uncertain result.
import { KaleidoClient } from 'kaleido-sdk'
import { loadEnvFile } from 'node:process'
import { existsSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { config, makePlan } from './merchant-plan.mjs'
import { nextChannel, readJournal, requireKnownOrder, saveJournal } from './merchant-orders.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const envFile = resolve(root, '.env')
if (existsSync(envFile)) loadEnvFile(envFile)
const file = resolve(root, '.local-app/merchant-orders.json')
const lockFile = resolve(root, '.local-app/merchant-orders.lock')
const nodeUrl = process.env.RGB_NODE_URL ?? `http://127.0.0.1:${process.env.RGB_NODE_PORT ?? '3901'}`
const baseUrl = process.env.KALEIDO_API_URL ?? 'https://api.signet.kaleidoswap.com'

async function withClient(fn) {
  const client = KaleidoClient.create({ nodeUrl, baseUrl, timeout: 30 })
  try {
    const [network, node] = await Promise.all([client.rln.getNetworkInfo(), client.rln.getNodeInfo()])
    if (network.network.toLowerCase() !== 'signetcustom') throw Error('Mutinynet node required')
    const journal = readJournal(file)
    if (journal && (journal.nodePubkey !== node.pubkey || journal.network !== network.network || journal.baseUrl !== baseUrl)) {
      throw Error('Saved orders belong to another wallet/network/market; refusing to proceed')
    }
    return await fn(client, node, network, journal)
  } finally { await client.close() }
}

async function showStatus(client, journal, includeHistorical = true) {
  if (!journal) return console.log('No merchant orders recorded locally.')
  for (const ticker of includeHistorical ? ['BTC', 'USDT'] : ['BTC']) {
    if (!journal.channels[ticker]) continue
    const entry = requireKnownOrder(journal, ticker)
    const order = await client.maker.getLspOrder({ order_id: entry.orderId, access_token: entry.accessToken })
    if (order.client_pubkey !== journal.nodePubkey || (order.asset_id ?? null) !== (entry.assetId ?? null)) {
      throw Error(`Unexpected identity/asset for ${ticker} order; inspect manually`)
    }
    entry.state = order.order_state
    saveJournal(file, journal)
    console.log(JSON.stringify({ ticker, orderId: entry.orderId, state: order.order_state,
      onchainPaymentState: order.payment.onchain.state, onchainOrderTotalSat: order.payment.onchain.order_total_sat,
      onchainExpiresAt: order.payment.onchain.expires_at,
      channel: order.channel, failureReason: order.failure_reason ?? null,
      ...(ticker === 'USDT' ? { note: 'Historical failed USDT order retained for refund tracking; BTC-only setup will not retry it.' } : {}) }, null, 2))
    if (ticker === 'BTC' && order.channel?.channel_id) {
      const channels = await client.rln.listChannels()
      const live = channels.channels.find((channel) => channel.channel_id === order.channel.channel_id)
      console.log(JSON.stringify({ btcNodeChannel: live ? { status: live.status, ready: live.ready,
        isUsable: live.is_usable, inboundBalanceMsat: live.inbound_balance_msat,
        channelId: live.channel_id } : null,
        note: live?.ready && live?.is_usable ? 'Channel usable; test a small BTC invoice before relying on it.'
          : 'BTC channel not yet usable. Do not treat order COMPLETED as proof of readiness.' }, null, 2))
    }
  }
}

export function paymentTerms(order, journal, entry, now = Date.now()) {
  if (entry.paymentAttempt) throw Error('Payment submission already attempted; inspect txid and LSP state before any retry')
  if (order.order_id !== entry.orderId || order.client_pubkey !== journal.nodePubkey ||
      (order.asset_id ?? null) !== (entry.assetId ?? null)) throw Error('Order identity mismatch')
  if (order.order_state !== 'CREATED' || order.payment?.onchain?.state !== 'EXPECT_PAYMENT') {
    throw Error('Order no longer awaiting on-chain payment')
  }
  const p = order.payment.onchain
  // LSP may omit the UTC suffix on its status response; interpret that as UTC, not local time.
  const expiry = /(?:Z|[+-]\d\d:\d\d)$/.test(p.expires_at) ? p.expires_at : `${p.expires_at}Z`
  if (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) < now + 120_000) {
    throw Error('Payment expiry too close or invalid; do not send')
  }
  if (!Number.isSafeInteger(p.order_total_sat) || p.order_total_sat <= 0 ||
      !/^tb1[ac-hj-np-z02-9]{20,}$/i.test(p.address)) throw Error('Unexpected payment amount or signet address')
  return { address: p.address, amount: p.order_total_sat, expiry }
}

async function payExisting(client, node, journal) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw Error('Interactive terminal required')
  const ticker = process.argv[3]
  if (ticker !== 'BTC') throw Error('Only BTC merchant orders are supported; use npm run merchant:pay -- BTC')
  const entry = requireKnownOrder(journal, ticker)
  if (journal.nodePubkey !== node.pubkey) throw Error('Wallet identity mismatch')
  const order = await client.maker.getLspOrder({ order_id: entry.orderId, access_token: entry.accessToken })
  const terms = paymentTerms(order, journal, entry)
  const balance = await client.rln.getBtcBalance(false)
  if (balance.vanilla.spendable < terms.amount + 2000) throw Error('Insufficient spendable BTC with fee reserve')
  const feeRate = 2 // sat/vbyte; miner fee is additional and depends on transaction size
  console.log(JSON.stringify({ ticker, orderId: entry.orderId, address: terms.address,
    paymentSat: terms.amount, expiry: terms.expiry, feeRateSatPerVbyte: feeRate,
    warning: 'This sends test BTC on-chain. Miner fee is additional and not known exactly until broadcast. A failed/timeout response is NOT safe to retry.' }, null, 2))
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let answer
  try { answer = await rl.question(`Type PAY ${ticker} ${terms.amount} to send, or Enter to cancel: `) } finally { rl.close() }
  if (answer !== `PAY ${ticker} ${terms.amount}`) return console.log('Cancelled; no payment sent.')
  // Verify again immediately before submitting; never reuse stale payment terms.
  const fresh = await client.maker.getLspOrder({ order_id: entry.orderId, access_token: entry.accessToken })
  const latest = paymentTerms(fresh, journal, entry)
  if (latest.address !== terms.address || latest.amount !== terms.amount || latest.expiry !== terms.expiry) {
    throw Error('LSP payment terms changed; no funds sent. Run pay again to review.')
  }
  entry.paymentAttempt = { state: 'SUBMISSION_UNKNOWN', address: terms.address, amountSat: terms.amount,
    feeRateSatPerVbyte: feeRate, at: new Date().toISOString() }
  saveJournal(file, journal)
  const sent = await client.rln.sendBtc({ address: terms.address, amount: terms.amount, fee_rate: feeRate, skip_sync: false })
  if (!/^[0-9a-f]{64}$/i.test(sent.txid)) throw Error('Unexpected txid; submission may have succeeded. Do not retry.')
  entry.paymentAttempt = { ...entry.paymentAttempt, state: 'BROADCAST', txid: sent.txid }
  saveJournal(file, journal)
  console.log(JSON.stringify({ ticker, txid: sent.txid, paymentSat: terms.amount,
    note: 'Broadcast submitted; not yet confirmed or completed. Check merchant:status. Do not pay again.' }, null, 2))
}

async function createNext(client, node, network, journal) {
  if (journal?.channels.BTC) await showStatus(client, journal, false)
  const ticker = nextChannel(journal)
  if (!ticker) {
    console.log('BTC order already recorded. No new orders will be created. Check BTC channel readiness with merchant:status.')
    return
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw Error('Interactive terminal required; no automated order submissions')
  const [lsp, lspNetwork, market, balance] = await Promise.all([
    client.maker.getLspInfo(), client.maker.getLspNetworkInfo(), client.maker.listAssets(), client.rln.getBtcBalance(false),
  ])
  if (lspNetwork.network.toLowerCase() !== 'signetcustom') throw Error('LSP is not on Mutinynet')
  const base = { lsp_balance_sat: config.lspBalanceSat, client_balance_sat: config.clientBalanceSat, channel_expiry_blocks: config.expiryBlocks }
  const fees = [await client.maker.estimateLspFees(base)]
  const plan = makePlan({ node: { network: network.network, pubkey: node.pubkey, spendable: balance.vanilla.spendable }, lsp, market, fees })
  const item = plan.channels.find((ch) => ch.ticker === ticker)
  if (balance.vanilla.spendable < item.lspBalanceSat + item.feeEstimateSat) throw Error('Insufficient BTC even for rough estimated order cost')
  const req = { client_pubkey: node.pubkey, ...base, required_channel_confirmations: 1,
    funding_confirms_within_blocks: 144, announce_channel: false }
  console.log(JSON.stringify({ step: `Create ${ticker} LSP order (not payment)`, request: req,
    estimatedFeeSat: item.feeEstimateSat, availableSat: balance.vanilla.spendable,
    warning: 'Creating an order contacts and connects to the LSP. The exact payment total is only known AFTER order creation. No payment is made by this command.' }, null, 2))
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let answer
  try { answer = await rl.question(`Type CREATE ${ticker} ORDER to submit, or Enter to cancel: `) } finally { rl.close() }
  if (answer !== `CREATE ${ticker} ORDER`) return console.log('Cancelled; no order created.')
  await client.rln.connectPeer({ peer_pubkey_and_addr: lsp.lsp_connection_url })
  // Intent is written BEFORE the remote order request. If the response is lost, never retry automatically.
  const record = journal ?? { network: network.network, nodePubkey: node.pubkey, baseUrl, channels: {} }
  record.channels[ticker] = { state: 'SUBMISSION_UNKNOWN', assetId: null,
    request: req, submittedAt: new Date().toISOString() }
  saveJournal(file, record, !journal)
  const order = await client.maker.createLspOrder(req)
  if (!order.order_id || !order.access_token || order.client_pubkey !== node.pubkey ||
      (order.asset_id ?? null) !== (record.channels[ticker].assetId ?? null)) {
    throw Error('Order response incomplete or mismatched; journal retained. Do not retry.')
  }
  record.channels[ticker] = { ...record.channels[ticker], orderId: order.order_id,
    accessToken: order.access_token, state: order.order_state }
  saveJournal(file, record)
  console.log(JSON.stringify({ ticker, orderId: order.order_id, state: order.order_state,
    onchainOrderTotalSat: order.payment.onchain.order_total_sat,
    onchainExpiresAt: order.payment.onchain.expires_at,
    note: 'Order recorded. NOT paid. Run merchant:status. Payment instructions are stored by the LSP; do not pay until terms are reviewed.' }, null, 2))
}

const mode = process.argv[2]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && !['setup', 'status', 'pay'].includes(mode)) {
  console.error('Usage: npm run merchant:setup | npm run merchant:status | npm run merchant:pay -- BTC')
  process.exitCode = 1
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  async function run() {
    mkdirSync(resolve(root, '.local-app'), { recursive: true, mode: 0o700 })
    const fd = openSync(lockFile, 'wx', 0o600)
    try {
      return await withClient(async (client, node, network, journal) => mode === 'status'
        ? showStatus(client, journal) : mode === 'pay'
          ? payExisting(client, node, journal) : createNext(client, node, network, journal))
    } finally { closeSync(fd); unlinkSync(lockFile) }
  }
  run().catch((error) => { console.error(`Merchant ${mode} failed: ${error.message}`); process.exitCode = 1 })
}
