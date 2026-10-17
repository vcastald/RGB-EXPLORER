import Fastify from 'fastify'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createKaleidoService } from './services/kaleido.js'
import { registerWalletRoutes } from './routes/wallet.js'
import type { WalletService } from './services/kaleido.js'
import { registerQuotesRoutes } from './routes/quotes.js'
import type { OverviewService } from './services/kaleido.js'

declare module 'fastify' {
  interface FastifyInstance {
    kaleidoService: WalletService
  }
}

export function createApp(options: { nodeUrl?: string; fetchNode?: typeof fetch; kaleidoService?: WalletService } = {}) {
  const app = Fastify({ logger: true })
  const nodeUrl = options.nodeUrl ?? process.env.RGB_NODE_URL ?? `http://${process.env.RGB_NODE_HOST ?? '127.0.0.1'}:${process.env.RGB_NODE_PORT ?? '3901'}`
  const fetchNode = options.fetchNode ?? fetch
  const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const dbPath = resolve(projectRoot, process.env.APP_DB_PATH ?? '.local-app/addresses.sqlite')
  const liveService = options.kaleidoService ? undefined : createKaleidoService(nodeUrl, dbPath)

  app.decorate('kaleidoService', options.kaleidoService ?? liveService!)
  if (liveService) app.addHook('onClose', async () => { await liveService.close() })

  app.get('/api/health', async () => ({ status: 'ok' }))

  registerWalletRoutes(app)
  registerQuotesRoutes(app)

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
