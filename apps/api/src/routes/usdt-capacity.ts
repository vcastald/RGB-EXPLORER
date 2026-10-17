import type { FastifyInstance } from 'fastify'
import { LspUnavailable, UnsupportedUsdtProposal } from '../services/usdt-capacity.js'

export function registerUsdtCapacityRoutes(app: FastifyInstance) {
  app.get('/api/lightning/usdt/capacity', async (_request, reply) => {
    try { return await app.usdtCapacityService.getCapacity() }
    catch (error) {
      app.log.warn({ error }, 'USDT channel capacity unavailable')
      return reply.code(503).send({ error: 'Local node unavailable; retry lookup' })
    }
  })

  app.post<{ Body: { additionalUsdt: number } }>('/api/lightning/usdt/estimate', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['additionalUsdt'],
      properties: { additionalUsdt: { type: 'integer', minimum: 1, maximum: 1000 } } } },
  }, async (request, reply) => {
    try { return await app.usdtCapacityService.estimate(request.body.additionalUsdt) }
    catch (error) {
      if (error instanceof UnsupportedUsdtProposal) return reply.code(422).send({ error: error.message })
      if (error instanceof LspUnavailable) return reply.code(503).send({ error: error.message, stage: 'lsp', orderCreated: false })
      app.log.warn({ error }, 'USDT capacity lookup unavailable')
      return reply.code(503).send({ error: 'Local node unavailable; retry lookup later', stage: 'node', orderCreated: false })
    }
  })
}
