import type { FastifyInstance } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { ProvisionError, type UsdtChannels } from '../services/usdt-channels.js'

export function registerUsdtChannelRoutes(app: FastifyInstance, service?: UsdtChannels, token?: string) {
  app.register(async scope => {
    scope.addHook('onRequest', async (request, reply) => {
      if (!service || !token || token.length < 32) return reply.code(503).send({ error: 'Channel provisioning disabled' })
      const supplied = Buffer.from(request.headers.authorization ?? '')
      const expected = Buffer.from(`Bearer ${token}`)
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply.code(401).send({ error: 'Unauthorized' })
    })
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof ProvisionError) return reply.code(error.statusCode).send({ error: error.message })
      if (error && typeof error === 'object' && 'statusCode' in error && (error.statusCode === 400 || error.statusCode === 413)) return reply.code(error.statusCode).send({ error: 'Invalid request body' })
      return reply.code(500).send({ error: 'Channel operation unavailable; check status before retrying' })
    })
    scope.post('/api/lightning/usdt/channels', { bodyLimit: 2048 }, async (request, reply) => {
      const key = request.headers['idempotency-key']
      if (typeof key !== 'string') throw new ProvisionError('Idempotency-Key required', 400)
      const op = service!.create(key, request.body)
      return reply.code(202).header('Location', `/api/lightning/usdt/channels/${op.operationId}`).send(op)
    })
    scope.get<{ Params: { id: string } }>('/api/lightning/usdt/channels/:id', async request => service!.get(request.params.id))
  })
}
