import Fastify from 'fastify'
import { createUsdtInvoiceService, type UsdtInvoiceCreator } from './services/usdt-invoices.js'
import { registerUsdtInvoiceRoutes } from './routes/usdt-invoices.js'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createKaleidoService } from './services/kaleido.js'
import { registerWalletRoutes } from './routes/wallet.js'
import { registerQuotesRoutes } from './routes/quotes.js'
import { registerLightningRoutes } from './routes/lightning.js'
import { createLightningService } from './services/lightning.js'
import { createUsdtCapacityService } from './services/usdt-capacity.js'
import type { UsdtCapacityReader } from './services/usdt-capacity.js'
import { registerUsdtCapacityRoutes } from './routes/usdt-capacity.js'
import type { LightningReadinessService } from './services/lightning.js'
import type { WalletService } from './services/kaleido.js'

declare module 'fastify' {
  interface FastifyInstance {
    kaleidoService: WalletService
    lightningService: LightningReadinessService
    usdtInvoiceService: UsdtInvoiceCreator
    usdtCapacityService: UsdtCapacityReader
  }
}

export function createApp(options: { nodeUrl?: string; fetchNode?: typeof fetch; kaleidoService?: WalletService; lightningService?: LightningReadinessService; usdtCapacityService?: UsdtCapacityReader; usdtInvoiceService?: UsdtInvoiceCreator } = {}) {
  const app = Fastify({ logger: true })
  const nodeUrl = options.nodeUrl ?? process.env.RGB_NODE_URL ?? `http://${process.env.RGB_NODE_HOST ?? '127.0.0.1'}:${process.env.RGB_NODE_PORT ?? '3901'}`
  const fetchNode = options.fetchNode ?? fetch
  const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const dbPath = resolve(projectRoot, process.env.APP_DB_PATH ?? '.local-app/addresses.sqlite')
  const liveService = options.kaleidoService ? undefined : createKaleidoService(nodeUrl, dbPath)

  const liveLightning = options.lightningService ? undefined : createLightningService(nodeUrl)
  app.decorate('lightningService', options.lightningService ?? liveLightning!)
  if (liveLightning) app.addHook('onClose', async () => { await liveLightning.close() })

  const liveUsdt = options.usdtCapacityService ? undefined : createUsdtCapacityService(nodeUrl)
  app.decorate('usdtCapacityService', options.usdtCapacityService ?? liveUsdt!)
  if (liveUsdt) app.addHook('onClose', async () => { await liveUsdt.close() })

  app.decorate('kaleidoService', options.kaleidoService ?? liveService!)
  if (liveService) app.addHook('onClose', async () => { await liveService.close() })

  app.get('/api/health', async () => ({ status: 'ok' }))

  const liveUsdtInvoices = options.usdtInvoiceService ? undefined : createUsdtInvoiceService(nodeUrl)
  app.decorate('usdtInvoiceService', options.usdtInvoiceService ?? liveUsdtInvoices!)
  if (liveUsdtInvoices) app.addHook('onClose', async () => { await liveUsdtInvoices.close() })
  registerUsdtInvoiceRoutes(app)

  registerWalletRoutes(app)
  registerQuotesRoutes(app)
  registerLightningRoutes(app)
  registerUsdtCapacityRoutes(app)

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
