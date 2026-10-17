import type { FastifyInstance } from 'fastify'
import { InvalidUsdtAmount, UsdtInvoiceUnavailable } from '../services/usdt-invoices.js'

export function registerUsdtInvoiceRoutes(app: FastifyInstance) {
  app.post<{ Body: { amountUsdt: string; description?: string } }>('/api/lightning/usdt/invoices', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['amountUsdt'], properties: {
      amountUsdt: { type: 'string', pattern: '^(0|[1-9]\\d{0,3})(\\.\\d{1,6})?$', maxLength: 11 },
      description: { type: 'string', maxLength: 200 },
    } } },
  }, async (request, reply) => {
    try {
      return reply.code(201).send(await app.usdtInvoiceService.createInvoice(request.body.amountUsdt, request.body.description))
    } catch (error) {
      if (error instanceof InvalidUsdtAmount) return reply.code(400).send({ error: error.message })
      if (error instanceof UsdtInvoiceUnavailable) return reply.code(409).send({ error: error.message })
      app.log.warn({ error }, 'USDT invoice creation unavailable')
      return reply.code(503).send({ error: 'Node unavailable or invoice creation uncertain; do not retry automatically' })
    }
  })
}
