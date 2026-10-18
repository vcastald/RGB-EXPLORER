import { KaleidoClient } from 'kaleido-sdk'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, openSync, writeSync, fsyncSync, closeSync, unlinkSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { MUTINYNET_USDT } from './usdt-capacity.js'

type Client = ReturnType<typeof KaleidoClient.create>
type Order = Awaited<ReturnType<Client['maker']['createLspOrder']>>
export type ChannelInput = { inboundUsdt: string; clientBalanceSat: number; maxOrderPaymentSat: number; acceptUncappedMinerFee: true }
type State = 'QUEUED' | 'VALIDATING' | 'ORDER_UNKNOWN' | 'PAYMENT_UNKNOWN' | 'OPENING' | 'READY' | 'REVIEW_REQUIRED' | 'REJECTED'
type Operation = { id: string; key: string; input: ChannelInput; state: State; provider: string; createdAt: string; node?: string; peer?: string; request?: Record<string, unknown>; order?: Order; txid?: string; reason?: string }
export class ProvisionError extends Error { constructor(message: string, public statusCode = 409) { super(message) } }
const providers: Record<string, string> = { 'https://api.mutinynet2.kaleidoswap.com': 'usdt-order-mutinynet2', 'https://api.signet.kaleidoswap.com': 'usdt-order' }
const terminal = (s: State) => s === 'READY' || s === 'REJECTED'
export function validateChannelInput(value: unknown): ChannelInput {
  const v = value as ChannelInput
  if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['inboundUsdt', 'clientBalanceSat', 'maxOrderPaymentSat', 'acceptUncappedMinerFee'].includes(k)) ||
      typeof v.inboundUsdt !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(v.inboundUsdt) || units(v.inboundUsdt) <= 0 ||
      !Number.isSafeInteger(v.clientBalanceSat) || v.clientBalanceSat < 0 || v.clientBalanceSat > 1000000 ||
      !Number.isSafeInteger(v.maxOrderPaymentSat) || v.maxOrderPaymentSat <= 0 || v.maxOrderPaymentSat > 10000000 || v.acceptUncappedMinerFee !== true) {
    throw new ProvisionError('Invalid parameters; explicit acceptUncappedMinerFee: true is required', 400)
  }
  return { inboundUsdt: v.inboundUsdt, clientBalanceSat: v.clientBalanceSat, maxOrderPaymentSat: v.maxOrderPaymentSat, acceptUncappedMinerFee: true }
}
function units(s: string) { const [whole, fraction = ''] = s.split('.'); return Number(whole) * 1000000 + Number(fraction.padEnd(6, '0')) }
function requireTrue(ok: unknown, message: string): asserts ok { if (!ok) throw new ProvisionError(message) }

/** Durable, fail-closed workflow. No submitted create/payment is ever retried. */
export class UsdtChannels {
  private db: DatabaseSync
  private tasks = new Set<Promise<void>>()
  private timer?: ReturnType<typeof setInterval>
  private polling = false
  private closed = false
  private halted = false
  constructor(private client: Pick<Client, 'rln' | 'maker'>, private dir: string, private provider: string) {
    requireTrue(providers[provider], 'Unsupported USDT provider')
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const path = join(dir, 'usdt-channel-operations.sqlite')
    this.db = new DatabaseSync(path); chmodSync(path, 0o600)
    this.db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, active INTEGER NOT NULL, record TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_channel_operation ON operations(active) WHERE active=1;`)
    // A process restart never resumes spending, even when the crash preceded submission.
    for (const op of this.all()) if (!terminal(op.state) && op.state !== 'OPENING') {
      op.state = 'REVIEW_REQUIRED'; op.reason = 'Process restarted; manual reconciliation required. No submission will be retried.'; this.save(op)
    }
  }
  private all() { return this.db.prepare('SELECT record FROM operations').all().map(r => JSON.parse(String(r.record)) as Operation) }
  private save(op: Operation) { this.db.prepare('UPDATE operations SET active=?, record=? WHERE id=?').run(terminal(op.state) ? 0 : 1, JSON.stringify(op), op.id) }
  private public(op: Operation) { return { operationId: op.id, state: op.state, provider: op.provider, createdAt: op.createdAt, parameters: op.input,
    orderId: op.order?.order_id, orderPaymentSat: op.order?.payment?.onchain?.order_total_sat, txid: op.txid,
    receiveReady: op.state === 'READY', reason: op.reason, minerFeeRateSatPerVbyte: 2, minerFeeTotalCapped: false } }
  get(id: string) { const op = this.all().find(o => o.id === id); if (!op) throw new ProvisionError('Operation not found', 404); return this.public(op) }
  create(key: string, value: unknown) {
    requireTrue(!this.closed && !this.halted, 'Service closing or persistence failure; manual reconciliation required')
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new ProvisionError('Idempotency-Key must contain 8–128 letters, digits, underscores or hyphens', 400)
    const input = validateChannelInput(value)
    const previous = this.all().find(o => o.key === key)
    if (previous) { requireTrue(JSON.stringify(previous.input) === JSON.stringify(input) && previous.provider === this.provider, 'Idempotency key reused with different parameters/provider'); return this.public(previous) }
    requireTrue(!this.all().some(o => !terminal(o.state)), 'Another operation requires completion or reconciliation')
    const op: Operation = { id: randomUUID(), key, input, provider: this.provider, state: 'QUEUED', createdAt: new Date().toISOString() }
    this.acquire(op)
    try { this.db.prepare('INSERT INTO operations VALUES (?, ?, 1, ?)').run(op.id, key, JSON.stringify(op)) }
    catch { this.release(op); throw new ProvisionError('Operation could not be persisted; no order submitted') }
    const task = new Promise<void>(resolve => setImmediate(resolve)).then(() => this.run(op)).catch(() => {
      // A persistence failure must keep the locks and halt this spender, not become an unhandled rejection.
      this.halted = true
    })
    this.tasks.add(task); void task.finally(() => this.tasks.delete(task))
    return this.public(op)
  }
  private locks() { return ['merchant-orders.lock', 'usdt-order.lock', 'usdt-order-mutinynet2.lock'].map(n => join(this.dir, n)) }
  private acquire(op: Operation) {
    try {
      for (const path of this.locks()) { const fd = openSync(path, 'wx', 0o600); try { writeSync(fd, op.id); fsyncSync(fd) } finally { closeSync(fd) } }
      const directory = openSync(this.dir, 'r'); try { fsyncSync(directory) } finally { closeSync(directory) }
    }
    catch { this.release(op); throw new ProvisionError('CLI or another channel workflow is active; do not remove uncertain-submission locks') }
  }
  private release(op: Operation) { for (const p of this.locks()) if (existsSync(p) && readFileSync(p, 'utf8') === op.id) unlinkSync(p) }
  private checkJournals() {
    for (const n of ['merchant-orders', 'usdt-order', 'usdt-order-mutinynet2']) {
      const p = join(this.dir, n + '.json')
      // Do not guess whether a CLI payment is safe to duplicate. Completed journals need deliberate review too.
      requireTrue(!existsSync(p), `Existing ${n}.json must be reconciled before API provisioning; do not archive an unresolved order`)
    }
  }
  private async identity(op: Operation) {
    const [node, network] = await Promise.all([this.client.rln.getNodeInfo(), this.client.rln.getNetworkInfo()])
    requireTrue(network.network.toLowerCase() === 'signetcustom', 'Mutinynet required')
    requireTrue(!op.node || node.pubkey === op.node, 'Wallet identity changed')
    op.node = node.pubkey
  }
  private validateOrder(op: Operation, order: Order, compareSaved = false) {
    const request = op.request!
    for (const k of ['client_pubkey', 'asset_id', 'lsp_balance_sat', 'client_balance_sat', 'lsp_asset_amount', 'client_asset_amount', 'channel_expiry_blocks', 'required_channel_confirmations', 'funding_confirms_within_blocks', 'announce_channel']) {
      requireTrue((order as unknown as Record<string, unknown>)[k] === request[k], 'Order identity/allocation mismatch')
    }
    requireTrue(order.order_id && order.access_token, 'Incomplete order credentials')
    requireTrue(order.order_state === 'CREATED' && order.payment?.onchain?.state === 'EXPECT_PAYMENT', 'Order is not awaiting payment')
    const terms = order.payment.onchain
    requireTrue(terms.refund_onchain_address === request.refund_onchain_address, 'Refund destination mismatch')
    requireTrue(Number.isSafeInteger(terms.order_total_sat) && terms.order_total_sat > 0 && terms.order_total_sat <= op.input.maxOrderPaymentSat, 'Order payment exceeds approved cap or is invalid')
    requireTrue(/^tb1[ac-hj-np-z02-9]{20,}$/i.test(terms.address), 'Invalid payment address')
    const saved = op.order?.payment.onchain
    let expiry = terms.expires_at
    if (compareSaved) {
      requireTrue(op.order?.order_id === order.order_id && op.order?.access_token === order.access_token && saved?.address === terms.address && saved?.order_total_sat === terms.order_total_sat, 'Payment terms changed')
      // Some status responses omit the UTC suffix; accept only the identical saved UTC wall clock.
      requireTrue(expiry === saved?.expires_at || (saved?.expires_at.endsWith('Z') && expiry === saved.expires_at.slice(0, -1)), 'Expiry changed')
      expiry = saved!.expires_at
    }
    requireTrue(/Z$|[+-]\d\d:\d\d$/.test(expiry) && Date.parse(expiry) > Date.now() + 120000, 'Expiry ambiguous or too close')
  }
  private async run(op: Operation) {
    try {
      op.state = 'VALIDATING'; this.save(op); this.checkJournals(); await this.identity(op)
      const [info, network, listed] = await Promise.all([this.client.maker.getLspInfo(), this.client.maker.getLspNetworkInfo(), this.client.rln.listChannels()])
      requireTrue(network.network.toLowerCase() === 'signetcustom', 'LSP network mismatch')
      requireTrue(!listed.channels.some(c => c.asset_id === MUTINYNET_USDT), 'An existing USDT channel requires review before purchasing another')
      const a = info.assets.find(a => a.asset_id === MUTINYNET_USDT && a.ticker === 'USDT' && a.precision === 6), o = info.options, amount = units(op.input.inboundUsdt)
      requireTrue(a, 'USDT unsupported')
      const within = (v: number, min: number, max: number) => Number.isSafeInteger(v) && v >= min && v <= max
      requireTrue(within(amount, a.min_initial_lsp_amount, a.max_initial_lsp_amount) && within(amount, a.min_channel_amount, a.max_channel_amount) && within(0, a.min_initial_client_amount, a.max_initial_client_amount) &&
        within(50000, o.min_initial_lsp_balance_sat, o.max_initial_lsp_balance_sat) && within(op.input.clientBalanceSat, o.min_initial_client_balance_sat, o.max_initial_client_balance_sat) &&
        within(50000 + op.input.clientBalanceSat, o.min_channel_balance_sat, o.max_channel_balance_sat) && 13140 <= o.max_channel_expiry_blocks && 1 >= o.min_required_channel_confirmations && 6 >= Math.max(1, o.min_funding_confirms_within_blocks), 'Proposal exceeds live LSP limits')
      const request = { client_pubkey: op.node!, asset_id: MUTINYNET_USDT, lsp_balance_sat: 50000, client_balance_sat: op.input.clientBalanceSat, lsp_asset_amount: amount, client_asset_amount: 0, channel_expiry_blocks: 13140, required_channel_confirmations: 1, funding_confirms_within_blocks: 6, announce_channel: true }
      const fee = await this.client.maker.estimateLspFees(request)
      requireTrue(Number.isSafeInteger(fee.total_fee) && fee.total_fee >= 0 && fee.total_fee + op.input.clientBalanceSat <= op.input.maxOrderPaymentSat, 'Estimate exceeds approved order cap')
      const balance = await this.client.rln.getBtcBalance(false)
      requireTrue(balance.vanilla.spendable >= fee.total_fee + op.input.clientBalanceSat + 2000, 'Insufficient test BTC with reserve')
      await this.client.rln.connectPeer({ peer_pubkey_and_addr: info.lsp_connection_url })
      const refund = (await this.client.rln.getAddress()).address
      requireTrue(/^tb1[ac-hj-np-z02-9]{20,}$/i.test(refund), 'Invalid refund address')
      op.peer = info.lsp_connection_url.split('@')[0]; op.request = { ...request, refund_onchain_address: refund }; await this.identity(op)
      op.state = 'ORDER_UNKNOWN'; this.save(op)
      const order = await this.client.maker.createLspOrder({ ...request, refund_onchain_address: refund })
      // Persist returned credentials even if terms fail validation; never lose reconciliation evidence.
      op.order = order; this.save(op); this.validateOrder(op, order)
      await this.identity(op)
      const btc = await this.client.rln.getBtcBalance(false)
      requireTrue(btc.vanilla.spendable >= order.payment.onchain.order_total_sat + 2000, 'Insufficient test BTC with reserve')
      const fresh = await this.client.maker.getLspOrder({ order_id: order.order_id, access_token: order.access_token! })
      this.validateOrder(op, fresh, true)
      op.state = 'PAYMENT_UNKNOWN'; this.save(op)
      const sent = await this.client.rln.sendBtc({ address: order.payment.onchain.address, amount: order.payment.onchain.order_total_sat, fee_rate: 2, skip_sync: false })
      requireTrue(/^[a-f0-9]{64}$/i.test(sent.txid), 'Invalid broadcast response')
      op.txid = sent.txid; op.state = 'OPENING'; this.save(op)
    } catch (error) {
      // Never expose upstream payloads/credentials in error messages.
      if (op.state === 'QUEUED' || op.state === 'VALIDATING') { op.state = 'REJECTED'; op.reason = error instanceof ProvisionError ? error.message : 'Preflight unavailable; no order submitted'; this.save(op); this.release(op) }
      else { op.reason = error instanceof ProvisionError ? error.message : 'Submission outcome uncertain; manual reconciliation required'; this.save(op) }
    }
  }
  async poll() {
    if (this.polling || this.closed) return
    this.polling = true
    try { for (const op of this.all().filter(o => o.state === 'OPENING')) {
      if (op.provider !== this.provider) continue
      try {
        await this.identity(op)
        const order = await this.client.maker.getLspOrder({ order_id: op.order!.order_id, access_token: op.order!.access_token! })
        requireTrue(order.client_pubkey === op.node && order.asset_id === MUTINYNET_USDT && order.order_id === op.order!.order_id, 'Status identity mismatch')
        if (order.order_state === 'FAILED') { op.state = 'REVIEW_REQUIRED'; op.reason = 'LSP order failed; refund follow-up required'; this.save(op); continue }
        const listed = await this.client.rln.listChannels()
        const channelId = (order as unknown as { channel?: { channel_id?: string } }).channel?.channel_id
        const channel = listed.channels.find(c => c.channel_id === channelId && c.asset_id === MUTINYNET_USDT && c.peer_pubkey === op.peer)
        if (order.order_state === 'COMPLETED' && channel?.status === 'Opened' && channel.ready && channel.is_usable && (channel.asset_remote_amount ?? 0) > 0 && channel.inbound_balance_msat >= 3000000) {
          op.state = 'READY'; op.reason = undefined; this.save(op); this.release(op)
        }
      } catch { /* Read failures do not trigger any payment or change persisted submission state. */ }
    } } finally { this.polling = false }
  }
  start() { if (!this.timer) { this.timer = setInterval(() => { void this.poll().catch(() => { this.halted = true }) }, 20000); this.timer.unref(); void this.poll().catch(() => { this.halted = true }) } }
  async idle() { await Promise.all(this.tasks) }
  async close() { this.closed = true; if (this.timer) clearInterval(this.timer); await this.idle(); while (this.polling) await new Promise(r => setTimeout(r, 10)); this.db.close() }
}
