import type { FastifyInstance } from 'fastify'

export function registerWalletRoutes(app: FastifyInstance) {
  app.get('/api/wallet/overview', async (_request, reply) => {
    try {
      return await app.kaleidoService.getOverview()
    } catch (error) {
      app.log.warn({ error }, 'Wallet overview unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })
}
