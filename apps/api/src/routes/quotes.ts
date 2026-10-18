import type { FastifyInstance } from 'fastify'

export function registerQuotesRoutes(app: FastifyInstance) {
  app.get('/api/quotes', async (_request, reply) => {
    try {
      return await app.kaleidoService.getQuotes()
    } catch (error) {
      app.log.warn({ error }, 'Market quotes unavailable')
      return reply.code(503).send({ error: 'Quotes unavailable' })
    }
  })
}
