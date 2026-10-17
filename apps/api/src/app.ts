import Fastify from 'fastify'

export function createApp() {
  const app = Fastify({ logger: true })
  app.get('/api/health', async () => ({ status: 'ok' }))
  return app
}
