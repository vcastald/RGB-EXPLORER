// Shared channel parameters and order/payment validation for the guided USDT setup.
export const proposal = Object.freeze({
  lsp_balance_sat: 50000,
  client_balance_sat: 20000,
  channel_expiry_blocks: 13140,
  required_channel_confirmations: 1,
  funding_confirms_within_blocks: 6,
  announce_channel: true,
  lsp_asset_amount: 20000000,
  client_asset_amount: 0,
})
export const expectedUsdtId = 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0'

// Only an unambiguous UTC expiry from the order-creation response is trusted.
// LSP status has sometimes omitted timezone; match its wall-clock timestamp to the saved UTC value.
export function checkedTerms(order, journal, now = Date.now()) {
  const saved = journal.order
  if (!saved?.orderId || !saved?.accessToken || !saved?.terms) throw Error('Order creation uncertain; do not retry')
  if (saved.paymentAttempt) throw Error('Payment already attempted; reconcile, never pay twice')
  if (order.order_id !== saved.orderId || order.client_pubkey !== journal.nodePubkey ||
      order.asset_id !== expectedUsdtId || order.lsp_balance_sat !== proposal.lsp_balance_sat ||
      order.client_balance_sat !== proposal.client_balance_sat || order.lsp_asset_amount !== proposal.lsp_asset_amount ||
      order.client_asset_amount !== 0 || order.channel_expiry_blocks !== proposal.channel_expiry_blocks ||
      order.required_channel_confirmations !== proposal.required_channel_confirmations ||
      order.funding_confirms_within_blocks !== proposal.funding_confirms_within_blocks ||
      order.announce_channel !== proposal.announce_channel) throw Error('Order identity or allocation changed; do not pay')
  if (order.order_state !== 'CREATED' || order.payment?.onchain?.state !== 'EXPECT_PAYMENT') {
    throw Error('Order is not awaiting on-chain payment')
  }
  const original = saved.terms
  const live = order.payment.onchain
  if (!Number.isSafeInteger(original.amountSat) || original.amountSat <= 0 ||
      original.address !== live.address || original.amountSat !== live.order_total_sat ||
      !/^tb1[ac-hj-np-z02-9]{20,}$/i.test(original.address)) throw Error('Payment amount/address mismatch')
  // Do not interpret a timezone-less string in the machine's local timezone.
  const utc = original.expiresAt
  if (typeof utc !== 'string' || !/Z$/.test(utc) || !Number.isFinite(Date.parse(utc))) throw Error('Saved expiry ambiguous')
  const clock = (s) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.exec(s)?.[0]
  if (!clock(utc) || clock(utc) !== clock(live.expires_at) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z?$/.test(live.expires_at)) {
    throw Error('LSP expiry changed or invalid; do not pay')
  }
  if (Date.parse(utc) < now + 120_000) throw Error('Order expired or too close to expiry')
  if (live.refund_onchain_address !== saved.refundAddress) throw Error('Refund address not confirmed by LSP; do not pay')
  return original
}

export function validateOrder(order, nodePubkey, refundAddress) {
  if (!order.order_id || !order.access_token || order.client_pubkey !== nodePubkey ||
      order.asset_id !== expectedUsdtId || order.lsp_balance_sat !== proposal.lsp_balance_sat ||
      order.client_balance_sat !== proposal.client_balance_sat || order.lsp_asset_amount !== proposal.lsp_asset_amount ||
      order.client_asset_amount !== 0 || order.channel_expiry_blocks !== proposal.channel_expiry_blocks ||
      order.payment?.onchain?.refund_onchain_address !== refundAddress) {
    throw Error('Order response incomplete or mismatched; submission may have succeeded')
  }
  const p = order.payment.onchain
  if (!Number.isSafeInteger(p.order_total_sat) || p.order_total_sat <= 0 ||
      !/^tb1[ac-hj-np-z02-9]{20,}$/i.test(p.address)) throw Error('Invalid payment terms; do not pay')
  return { orderId: order.order_id, accessToken: order.access_token, state: order.order_state,
    terms: { address: p.address, amountSat: p.order_total_sat, expiresAt: p.expires_at }, refundAddress }
}

// Provider-specific journals preserve uncertain and failed purchases across LSP changes.
export function usdtProvider(baseUrl = 'https://api.mutinynet2.kaleidoswap.com') {
  const normalized = baseUrl.replace(/\/+$/, '')
  const journals = {
    'https://api.mutinynet2.kaleidoswap.com': 'usdt-order-mutinynet2',
    'https://api.signet.kaleidoswap.com': 'usdt-order',
  }
  if (!Object.hasOwn(journals, normalized)) throw Error('Unsupported USDT LSP; configure an explicit journal mapping before ordering')
  return { baseUrl: normalized, journalName: journals[normalized] }
}
