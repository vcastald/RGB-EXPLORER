import type { FastifyInstance } from 'fastify'
export function registerRgbReceivingRoutes(app: FastifyInstance) {
  app.register(async (sub) => {
    sub.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
      if (!body || body.trim() === '') {
        done(null, {})
        return
      }
      try {
        done(null, JSON.parse(body))
      } catch (err) {
        done(err as Error)
      }
    })

    sub.post('/api/rgb/transfers/refresh', async (_request, reply) => {
      try {
        return await sub.rgbReceivingService.refreshNow()
      } catch (error) {
        sub.log.warn({ error }, 'Manual RGB refresh unavailable')
        return reply.code(503).send({ error: 'RGB refresh failed or completion uncertain; payment not verified' })
      }
    })
  })

  app.get<{ Querystring: { recipientId: string } }>('/api/rgb/transfers/status', {
    schema: { querystring: { type: 'object', required: ['recipientId'], additionalProperties: false,
      properties: { recipientId: { type: 'string', minLength: 1, maxLength: 1024 } } } },
  }, async (request, reply) => {
    try {
      const result = await app.rgbReceivingService.status(request.query.recipientId)
      return result ?? reply.code(404).send({ error: 'Unknown recipient' })
    } catch (error) {
      app.log.warn({ error }, 'RGB transfer status unavailable')
      return reply.code(503).send({ error: 'RGB transfer status unavailable; payment not verified' })
    }
  })
}
