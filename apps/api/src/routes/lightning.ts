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
}
