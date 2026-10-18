import { KaleidoClient } from 'kaleido-sdk'
import type { AssignmentFungible } from 'kaleido-sdk/rln'
import { MUTINYNET_USDT } from './usdt-capacity.js'

type Rln = ReturnType<typeof KaleidoClient.create>['rln']
export type RgbInvoiceNode = Pick<Rln, 'getNetworkInfo' | 'listAssets' | 'createRgbInvoice'>
export class InvalidRgbAmount extends Error {}
export class RgbReceiveUnavailable extends Error {}
export const DEFAULT_RGB_PROXY = 'rpcs://proxy.iriswallet.com/0.2/json-rpc'

export const RGB_USDT = { id: MUTINYNET_USDT, ticker: 'USDT', precision: 6 }
export const RGB_XAUT = { id: 'rgb:qrilKFY5-VBmdIOF-cH5ziA8-9K9MIFS-OwsjmXe-yOv3Oa8', ticker: 'XAUT', precision: 9 }

// Shared witness-invoice implementation; the default preserves the USDT API.
export class RgbUsdtInvoiceService {
  constructor(private readonly node: RgbInvoiceNode, private readonly proxy = DEFAULT_RGB_PROXY,
    private readonly now = () => Date.now(), private readonly asset = RGB_USDT) {}

  async createInvoice(amountUsdt?: string, allowAnyAsset = false) {
    if (allowAnyAsset && amountUsdt !== undefined) throw new InvalidRgbAmount('Any-asset bootstrap invoices must omit the amount')
    let assetAmount: number | null = null
    if (amountUsdt !== undefined) {
      if (!new RegExp(`^(0|[1-9]\\d{0,3})(\\.\\d{1,${this.asset.precision}})?$`).test(amountUsdt)) throw new InvalidRgbAmount(`Use a decimal string with at most ${this.asset.precision} decimals`)
      const [whole, fraction = ''] = amountUsdt.split('.')
      assetAmount = Number(whole) * 10 ** this.asset.precision + Number(fraction.padEnd(this.asset.precision, '0'))
      if (assetAmount < 1 || assetAmount > 1000 * 10 ** this.asset.precision) throw new InvalidRgbAmount(`Amount must be positive and at most 1000 test-${this.asset.ticker}`)
    }
    const network = await this.node.getNetworkInfo()
    if (network.network.toLowerCase() !== 'signetcustom') throw new RgbReceiveUnavailable('Mutinynet node required')
    const assets = await this.node.listAssets()
    const known = assets.nia?.some(a => a.asset_id === this.asset.id && a.precision === this.asset.precision && a.ticker === this.asset.ticker)
    if (!known && !allowAnyAsset) {
      throw new RgbReceiveUnavailable(`Expected ${this.asset.ticker} asset is not known to this wallet; no generic-asset invoice was created`)
    }
    const anyAsset = !known && allowAnyAsset
    const result = await this.node.createRgbInvoice({ asset_id: anyAsset ? null : this.asset.id,
      assignment: assetAmount === null ? null : { type: 'Fungible' as AssignmentFungible['type'], value: assetAmount },
      witness: true, min_confirmations: 1, expiration_timestamp: Math.floor(this.now() / 1000) + 3600,
      transport_endpoints: [this.proxy] })
    return { invoice: result.invoice, recipientId: result.recipient_id,
      batchTransferIdx: result.batch_transfer_idx, expirationTimestamp: result.expiration_timestamp,
      assetId: anyAsset ? null : this.asset.id, assetPrecision: this.asset.precision, assetAmount, amountUsdt: amountUsdt ?? null,
      anyAsset, expectedAssetId: this.asset.id,
      ...(anyAsset ? { warning: `This invoice accepts any RGB asset. Select ${this.asset.ticker} at the faucet and verify the received contract.` } : {}),
      network: network.network, witness: true, minConfirmations: 1 }
  }
}
export type RgbUsdtInvoiceCreator = Pick<RgbUsdtInvoiceService, 'createInvoice'>
export function createRgbUsdtInvoiceService(nodeUrl: string) {
  const proxy = process.env.RGB_PROXY_ENDPOINT ?? DEFAULT_RGB_PROXY
  if (!/^rpcs?:\/\//.test(proxy)) throw new Error('RGB_PROXY_ENDPOINT must use rpc:// or rpcs://')
  const client = KaleidoClient.create({ nodeUrl, timeout: 10000 })
  const service = new RgbUsdtInvoiceService(client.rln, proxy)
  return { createInvoice: (amount?: string, allowAnyAsset?: boolean) => service.createInvoice(amount, allowAnyAsset), close: () => client.close() }
}
