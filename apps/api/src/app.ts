import { createRgbReceivingService, type RgbReceivingReader } from './services/rgb-receiving.js'
import { registerRgbReceivingRoutes } from './routes/rgb-receiving.js'
import { createRgbXautInvoiceService, type RgbXautInvoiceCreator } from './services/rgb-xaut-invoices.js'
import { registerRgbXautInvoiceRoutes } from './routes/rgb-xaut-invoices.js'
import { createRgbUsdtInvoiceService, type RgbUsdtInvoiceCreator } from './services/rgb-usdt-invoices.js'
import { registerRgbUsdtInvoiceRoutes } from './routes/rgb-usdt-invoices.js'
import Fastify from 'fastify'
import { createUsdtInvoiceService, type UsdtInvoiceCreator } from './services/usdt-invoices.js'
import { registerUsdtInvoiceRoutes } from './routes/usdt-invoices.js'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createKaleidoService } from './services/kaleido.js'
import { registerWalletRoutes } from './routes/wallet.js'
import { registerQuotesRoutes } from './routes/quotes.js'
import { registerLightningRoutes } from './routes/lightning.js'
import { registerParamsRoutes } from './routes/params.js'
import { createLightningService } from './services/lightning.js'
import { createUsdtCapacityService } from './services/usdt-capacity.js'
import type { UsdtCapacityReader } from './services/usdt-capacity.js'
import { registerUsdtCapacityRoutes } from './routes/usdt-capacity.js'
import { SqliteParamsStore, type ParamsStore } from './storage/params.js'
import type { LightningReadinessService } from './services/lightning.js'
import type { WalletService } from './services/kaleido.js'
import { registerChatRoutes } from './routes/chat.js'
import {
  configureTreasuryTools,
} from './services/ai-agent.mjs'

declare module 'fastify' {
  interface FastifyInstance {
    kaleidoService: WalletService
    lightningService: LightningReadinessService
    rgbReceivingService: RgbReceivingReader
    rgbXautInvoiceService: RgbXautInvoiceCreator
    rgbUsdtInvoiceService: RgbUsdtInvoiceCreator
    usdtInvoiceService: UsdtInvoiceCreator
    usdtCapacityService: UsdtCapacityReader
    paramsStore: ParamsStore
  }
}

export function createApp(options: {
  nodeUrl?: string
  fetchNode?: typeof fetch
  kaleidoService?: WalletService
  lightningService?: LightningReadinessService
  usdtCapacityService?: UsdtCapacityReader
  usdtInvoiceService?: UsdtInvoiceCreator
  rgbUsdtInvoiceService?: RgbUsdtInvoiceCreator
  rgbXautInvoiceService?: RgbXautInvoiceCreator
  rgbReceivingService?: RgbReceivingReader
  paramsStore?: ParamsStore
  paramsDbPath?: string
} = {}) {
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

  const paramsDbPath = options.paramsDbPath ?? resolve(projectRoot, process.env.PARAMS_DB_PATH ?? '.local-app/params.sqlite')
  const liveParamsStore = options.paramsStore ?? new SqliteParamsStore(paramsDbPath)
  app.decorate('paramsStore', liveParamsStore)
  if (!options.paramsStore) {
    app.addHook('onClose', async () => { liveParamsStore.close() })
  }

  configureTreasuryTools(
    app.paramsStore,
    () => app.kaleidoService.getQuotes(),
  );
  app.get('/api/health', async () => ({ status: 'ok' }))

  const liveUsdtInvoices = options.usdtInvoiceService ? undefined : createUsdtInvoiceService(nodeUrl)
  app.decorate('usdtInvoiceService', options.usdtInvoiceService ?? liveUsdtInvoices!)
  if (liveUsdtInvoices) app.addHook('onClose', async () => { await liveUsdtInvoices.close() })
  registerUsdtInvoiceRoutes(app)

  const receiving = createRgbReceivingService(nodeUrl, dbPath, error => app.log.warn({ error }, 'RGB refresh failed'))
  app.decorate('rgbReceivingService', options.rgbReceivingService ?? receiving.service)
  app.addHook('onListen', async () => { if (!options.rgbReceivingService) receiving.service.start() })
  app.addHook('onClose', async () => { await receiving.close() })
  registerRgbReceivingRoutes(app)

  const liveRgbInvoices = options.rgbUsdtInvoiceService ? undefined : createRgbUsdtInvoiceService(nodeUrl)
  app.decorate('rgbUsdtInvoiceService', options.rgbUsdtInvoiceService ?? { createInvoice: (amount, allowAnyAsset) => receiving.service.track(() => liveRgbInvoices!.createInvoice(amount, allowAnyAsset)) })
  if (liveRgbInvoices) app.addHook('onClose', async () => { await liveRgbInvoices.close() })
  registerRgbUsdtInvoiceRoutes(app)

  const liveXautInvoices = options.rgbXautInvoiceService ? undefined : createRgbXautInvoiceService(nodeUrl)
  app.decorate('rgbXautInvoiceService', options.rgbXautInvoiceService ?? { createInvoice: (amount, anyAsset) => receiving.service.track(() => liveXautInvoices!.createInvoice(amount, anyAsset)) })
  if (liveXautInvoices) app.addHook('onClose', async () => { await liveXautInvoices.close() })
  registerRgbXautInvoiceRoutes(app)

  registerWalletRoutes(app)
  registerQuotesRoutes(app)
  registerLightningRoutes(app)
  registerUsdtCapacityRoutes(app)
  registerParamsRoutes(app)

  registerChatRoutes(app)

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