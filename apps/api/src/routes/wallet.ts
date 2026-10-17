import type { FastifyInstance } from 'fastify'
import { AddressStorageError } from '../storage/addresses.js'

export function registerWalletRoutes(app: FastifyInstance) {
  // POST because the node derives and persists a fresh address on each call.
  app.post('/api/wallet/deposit-addresses', async (_request, reply) => {
    try {
      return reply.code(201).send(await app.kaleidoService.createDepositAddress())
    } catch (error) {
      app.log.warn({ error }, 'Cannot create deposit address')
      if (error instanceof AddressStorageError) {
        return reply.code(500).send({ error: 'Address generated but could not be recorded; do not retry blindly' })
      }
      return reply.code(503).send({ error: 'Node unavailable or wrong network' })
    }
  })

  app.get('/api/wallet/deposit-addresses', async (_request, reply) => {
    try {
      return { addresses: await app.kaleidoService.listDepositAddresses() }
    } catch (error) {
      app.log.warn({ error }, 'Cannot list deposit addresses')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })

  app.get('/api/wallet/overview', async (_request, reply) => {
    try {
      return await app.kaleidoService.getOverview()
    } catch (error) {
      app.log.warn({ error }, 'Wallet overview unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })
}
