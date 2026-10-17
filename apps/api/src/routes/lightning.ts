import type { FastifyInstance } from 'fastify'

export function registerLightningRoutes(app: FastifyInstance) {
  app.get('/api/lightning/readiness', async (_request, reply) => {
    try {
      return await app.lightningService.getReadiness()
    } catch (error) {
      app.log.warn({ error }, 'Lightning readiness unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })

  app.post<{ Body: { amountSat: number; description?: string } }>('/api/lightning/invoices', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['amountSat'], properties: {
      amountSat: { type: 'integer', minimum: 1, maximum: 40000 },
      description: { type: 'string', maxLength: 200 },
    } } },
  }, async (request, reply) => {
    try {
      return reply.code(201).send(await app.lightningService.createBtcInvoice(request.body.amountSat, request.body.description))
    } catch (error) {
      app.log.warn({ error }, 'BTC Lightning invoice unavailable')
      return reply.code(503).send({ error: 'Node unavailable or insufficient BTC inbound liquidity' })
    }
  })

  app.post<{ Body: { invoice: string } }>('/api/lightning/invoices/status', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['invoice'], properties: {
      invoice: { type: 'string', minLength: 10, maxLength: 4096, pattern: '^ln[a-z0-9]+$', description: 'BTC Lightning invoice' },
    } } },
  }, async (request, reply) => {
    try {
      return await app.lightningService.getBtcInvoiceStatus(request.body.invoice)
    } catch (error) {
      app.log.warn({ error }, 'BTC Lightning invoice status unavailable')
      return reply.code(503).send({ error: 'Invoice status unavailable' })
    }
  })
}
