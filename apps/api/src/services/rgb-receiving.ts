import { KaleidoClient } from 'kaleido-sdk'
import type { AssetFilter } from 'kaleido-sdk/rln'
import { RgbReceiptStore } from '../storage/rgb-receipts.js'

type Rln = ReturnType<typeof KaleidoClient.create>['rln']
export type ReceivingNode = Pick<Rln, 'getNodeInfo' | 'getNetworkInfo' | 'listTransfers' | 'refreshTransfers' | 'listAssets'>
const allAssets = { type: 'AnyOrNone' } as AssetFilter
const incoming = (kind: string) => kind === 'ReceiveWitness' || kind === 'ReceiveBlind'

export class RgbReceivingService {
  private timer?: ReturnType<typeof setTimeout>
  private running?: Promise<void>
  private manualRefresh?: Promise<{ refreshed: true; refreshedAt: string }>
  private stopped = true
  private delay = 20000
  private lastRefreshAt: string | null = null
  private lastError: string | null = null
  constructor(private readonly node: ReceivingNode, private readonly store: RgbReceiptStore,
    private readonly log: (error: unknown) => void = () => {}) {}

  async identity() {
    const network = await this.node.getNetworkInfo()
    if (network.network.toLowerCase() !== 'signetcustom') throw Error('Mutinynet node required')
    return (await this.node.getNodeInfo()).pubkey
  }

  async track<T extends { recipientId: string; expectedAssetId: string; assetAmount: number | null; expirationTimestamp: number }>(create: () => Promise<T>) {
    const nodePubkey = await this.identity()
    const result = await create()
    // Do not report success if persistence fails; callers must reconcile uncertain creation.
    this.store.save({ recipientId: result.recipientId, nodePubkey, expectedAssetId: result.expectedAssetId,
      assetAmount: result.assetAmount, expirationTimestamp: result.expirationTimestamp })
    return result
  }

  tick(force = false): Promise<void> {
    if (this.running) return this.running
    this.running = this.refresh(force).finally(() => { this.running = undefined })
    return this.running
  }
  refreshNow(): Promise<{ refreshed: true; refreshedAt: string }> {
    if (this.manualRefresh) return this.manualRefresh
    this.manualRefresh = (async () => {
      // Wait for an automatic pass, then force a wallet refresh even if no pending
      // transfers were listed. Concurrent manual callers share this operation.
      await this.running
      await this.tick(true)
      if (this.lastError || !this.lastRefreshAt) throw Error('RGB refresh unavailable')
      return { refreshed: true as const, refreshedAt: this.lastRefreshAt }
    })().finally(() => { this.manualRefresh = undefined })
    return this.manualRefresh
  }
  private async refresh(force: boolean) {
    try {
      await this.identity()
      const transfers = force ? [] : (await this.node.listTransfers({ asset_filter: allAssets })).transfers
      if (force || transfers.some(t => incoming(t.kind) && t.status !== 'Settled' && t.status !== 'Failed')) {
        // No asset restriction: also retrieves first-receipt consignments for unknown XAUT.
        await this.node.refreshTransfers({ filter: [], skip_sync: false })
        this.lastRefreshAt = new Date().toISOString()
      }
      this.lastError = null
      this.delay = 20000
    } catch (error) {
      this.lastError = 'RGB refresh unavailable'
      this.delay = Math.min(this.delay * 2, 120000)
      this.log(error)
    }
  }
  start() {
    if (!this.stopped) return
    this.stopped = false
    const loop = async () => {
      await this.tick()
      if (!this.stopped) { this.timer = setTimeout(() => { void loop() }, this.delay); this.timer.unref() }
    }
    void loop()
  }
  async stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    await this.manualRefresh
    await this.running
  }

  async status(recipientId: string) {
    const nodePubkey = await this.identity()
    const record = this.store.get(nodePubkey, recipientId)
    const { transfers } = await this.node.listTransfers({ asset_filter: allAssets })
    const transfer = transfers.find(t => t.recipient_id === recipientId && incoming(t.kind))
    if (!transfer && !record) return null
    let actualAssetId: string | null = null
    if (transfer) {
      const assets = await this.node.listAssets()
      for (const asset of [...(assets.nia ?? []), ...(assets.cfa ?? []), ...(assets.uda ?? []), ...(assets.ifa ?? [])]) {
        const listed = await this.node.listTransfers({ asset_filter: { type: 'Id', value: asset.asset_id } as AssetFilter })
        if (listed.transfers.some(t => t.idx === transfer.idx && t.recipient_id === recipientId)) {
          actualAssetId = asset.asset_id; break
        }
      }
    }
    const units = transfer?.assignments.reduce((sum, a) => a.type === 'Fungible' ? sum + a.value : sum, 0) ?? 0
    const assetMatches = !!record && actualAssetId === record.expectedAssetId
    const amountMatches = !!record && (record.assetAmount === null ? units > 0 : units === record.assetAmount)
    return { recipientId, tracked: !!record, status: transfer?.status ?? 'NotObserved',
      txid: transfer?.txid ?? null, actualAssetId, receivedAssetUnits: units,
      expectedAssetId: record?.expectedAssetId ?? null, requestedAssetUnits: record?.assetAmount ?? null,
      assetMatches, amountMatches, paid: transfer?.status === 'Settled' && assetMatches && amountMatches,
      lastRefreshAt: this.lastRefreshAt, refreshError: this.lastError,
      ...(!record ? { warning: 'Invoice predates tracking; original expected asset/amount not recorded. Settlement alone does not verify its payment intent.' } : {}) }
  }
}
export type RgbReceivingReader = Pick<RgbReceivingService, 'status' | 'refreshNow'>
export function createRgbReceivingService(nodeUrl: string, dbPath: string, log: (error: unknown) => void) {
  const client = KaleidoClient.create({ nodeUrl, timeout: 10000 })
  const store = new RgbReceiptStore(dbPath)
  const service = new RgbReceivingService(client.rln, store, log)
  return { service, close: async () => { await service.stop(); await client.close(); store.close() } }
}
