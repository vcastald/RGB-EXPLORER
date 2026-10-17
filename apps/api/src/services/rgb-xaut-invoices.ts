import { KaleidoClient } from 'kaleido-sdk'
import { RgbUsdtInvoiceService, RGB_XAUT, DEFAULT_RGB_PROXY, type RgbInvoiceNode } from './rgb-usdt-invoices.js'

export class RgbXautInvoiceService {
  private readonly invoices: RgbUsdtInvoiceService
  constructor(node: RgbInvoiceNode, proxy = DEFAULT_RGB_PROXY, now = () => Date.now()) {
    this.invoices = new RgbUsdtInvoiceService(node, proxy, now, RGB_XAUT)
  }
  async createInvoice(amountXaut?: string, allowAnyAsset = false) {
    const { amountUsdt, ...result } = await this.invoices.createInvoice(amountXaut, allowAnyAsset)
    return { ...result, amountXaut: amountUsdt,
      ...(result.anyAsset ? { warning: 'This invoice accepts any RGB asset. Select XAUT at the faucet and verify the received contract before treating it as XAUT.' } : {}) }
  }
}
export type RgbXautInvoiceCreator = Pick<RgbXautInvoiceService, 'createInvoice'>
export function createRgbXautInvoiceService(nodeUrl: string) {
  const proxy = process.env.RGB_PROXY_ENDPOINT ?? DEFAULT_RGB_PROXY
  if (!/^rpcs?:\/\//.test(proxy)) throw new Error('RGB_PROXY_ENDPOINT must use rpc:// or rpcs://')
  const client = KaleidoClient.create({ nodeUrl, timeout: 10000 })
  const service = new RgbXautInvoiceService(client.rln, proxy)
  return { createInvoice: (amount?: string, allowAnyAsset?: boolean) => service.createInvoice(amount, allowAnyAsset), close: () => client.close() }
}
