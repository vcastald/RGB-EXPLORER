import type { FastifyInstance } from 'fastify'
import { InvalidRgbAmount, RgbReceiveUnavailable } from '../services/rgb-usdt-invoices.js'

export function registerRgbUsdtInvoiceRoutes(app: FastifyInstance) {
  app.post<{ Body: { amountUsdt?: string; allowAnyAsset?: boolean } }>('/api/rgb/usdt/invoices', {
    schema: { body: { type: 'object', additionalProperties: false, properties: {
      allowAnyAsset: { type: 'boolean', default: false },
      amountUsdt: { type: 'string', pattern: '^(0|[1-9]\\d{0,3})(\\.\\d{1,6})?$', maxLength: 11 },
    } } },
  }, async (request, reply) => {
    try {
      return reply.code(201).send(await app.rgbUsdtInvoiceService.createInvoice(request.body.amountUsdt, request.body.allowAnyAsset))
    } catch (error) {
      if (error instanceof InvalidRgbAmount) return reply.code(400).send({ error: error.message })
      if (error instanceof RgbReceiveUnavailable) return reply.code(409).send({ error: error.message })
      app.log.warn({ error }, 'RGB on-chain invoice creation unavailable')
      return reply.code(503).send({ error: 'Node unavailable or invoice creation uncertain; inspect transfers before retrying' })
    }
  })
}
