import { KaleidoClient } from 'kaleido-sdk'
import { MUTINYNET_USDT } from './usdt-capacity.js'

type Rln = ReturnType<typeof KaleidoClient.create>['rln']
export type UsdtInvoiceNode = Pick<Rln, 'getNetworkInfo' | 'listChannels' | 'createLNInvoice'>
export class UsdtInvoiceUnavailable extends Error {}
export class InvalidUsdtAmount extends Error {}

export class UsdtInvoiceService {
  constructor(private readonly node: UsdtInvoiceNode) {}

  async createInvoice(amountUsdt: string, description?: string) {
    // Decimal strings avoid floating-point rounding of RGB's six-decimal units.
    if (!/^(0|[1-9]\d{0,3})(\.\d{1,6})?$/.test(amountUsdt)) throw new InvalidUsdtAmount('Use a decimal string with at most six decimal places')
    const [whole, fraction = ''] = amountUsdt.split('.')
    const assetAmount = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'))
    if (assetAmount < 1 || assetAmount > 1_000_000_000) throw new InvalidUsdtAmount('Amount must be between 0.000001 and 1000 test-USDT')
    const [network, listed] = await Promise.all([this.node.getNetworkInfo(), this.node.listChannels()])
    if (network.network.toLowerCase() !== 'signetcustom') throw new UsdtInvoiceUnavailable('Mutinynet node required')
    const carrierMsat = 3_000_000
    if (!listed.channels.some(c => c.asset_id === MUTINYNET_USDT && c.status === 'Opened' && c.ready && c.is_usable &&
      (c.asset_remote_amount ?? 0) >= assetAmount && c.inbound_balance_msat >= carrierMsat)) {
      throw new UsdtInvoiceUnavailable('No usable USDT channel with sufficient asset and BTC inbound capacity')
    }
    const result = await this.node.createLNInvoice({ amt_msat: carrierMsat, expiry_sec: 300,
      asset_id: MUTINYNET_USDT, asset_amount: assetAmount,
      ...(description === undefined ? {} : { description }) })
    return { invoice: result.invoice, assetId: MUTINYNET_USDT, assetAmount, assetPrecision: 6,
      amountUsdt, carrierSat: 3000, expirySec: 300 }
  }
}
export type UsdtInvoiceCreator = Pick<UsdtInvoiceService, 'createInvoice'>
export function createUsdtInvoiceService(nodeUrl: string) {
  const client = KaleidoClient.create({ nodeUrl, timeout: 10000 })
  const service = new UsdtInvoiceService(client.rln)
  return { createInvoice: (amount: string, description?: string) => service.createInvoice(amount, description),
    close: () => client.close() }
}
