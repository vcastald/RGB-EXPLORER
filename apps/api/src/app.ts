import Fastify from 'fastify'

export function createApp(options: { nodeUrl?: string; fetchNode?: typeof fetch } = {}) {
  const app = Fastify({ logger: true })
  const nodeUrl = options.nodeUrl ?? process.env.RGB_NODE_URL ?? `http://${process.env.RGB_NODE_HOST ?? '127.0.0.1'}:${process.env.RGB_NODE_PORT ?? '3901'}`
  const fetchNode = options.fetchNode ?? fetch

  app.get('/api/health', async () => ({ status: 'ok' }))

  app.get('/api/node/status', async (_request, reply) => {
    try {
      const response = await fetchNode(new URL('/nodeinfo', nodeUrl), {
        signal: AbortSignal.timeout(2000),
      })
      if (!response.ok) throw new Error('Node API returned an error')
      const info: unknown = await response.json()
      if (!info || typeof info !== 'object' || !('pubkey' in info) || typeof info.pubkey !== 'string') {
        throw new Error('Invalid node response')
      }
      return { online: true, pubkey: info.pubkey }
    } catch {
      return reply.code(503).send({ online: false })
    }
  })

  return app
}
