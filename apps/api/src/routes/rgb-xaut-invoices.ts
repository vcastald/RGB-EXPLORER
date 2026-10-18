import type { FastifyInstance } from 'fastify'
import { InvalidRgbAmount, RgbReceiveUnavailable } from '../services/rgb-usdt-invoices.js'

export function registerRgbXautInvoiceRoutes(app: FastifyInstance) {
  app.post<{ Body: { amountXaut?: string; allowAnyAsset?: boolean } }>('/api/rgb/xaut/invoices', {
    schema: { body: { type: 'object', additionalProperties: false, properties: {
      amountXaut: { type: 'string', pattern: '^(0|[1-9]\\d{0,3})(\\.\\d{1,9})?$', maxLength: 14 },
      allowAnyAsset: { type: 'boolean', default: false },
    } } },
  }, async (request, reply) => {
    try {
      return reply.code(201).send(await app.rgbXautInvoiceService.createInvoice(request.body.amountXaut, request.body.allowAnyAsset))
    } catch (error) {
      if (error instanceof InvalidRgbAmount) return reply.code(400).send({ error: error.message })
      if (error instanceof RgbReceiveUnavailable) return reply.code(409).send({ error: error.message })
      app.log.warn({ error }, 'XAUT on-chain invoice creation unavailable')
      return reply.code(503).send({ error: 'Node unavailable or invoice creation uncertain; inspect transfers before retrying' })
    }
  })
}
