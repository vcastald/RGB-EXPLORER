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

  app.get('/api/wallet/transactions', async (_request, reply) => {
    try {
      return await app.kaleidoService.listTransactions()
    } catch (error) {
      app.log.warn({ error }, 'Wallet transactions unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })

  // Alias /api/transactions
  app.get('/api/transactions', async (_request, reply) => {
    try {
      return await app.kaleidoService.listTransactions()
    } catch (error) {
      app.log.warn({ error }, 'Transactions unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })

  app.get('/api/wallet/payments', async (_request, reply) => {
    try {
      return await app.kaleidoService.listPayments()
    } catch (error) {
      app.log.warn({ error }, 'Wallet payments unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })

  // Alias /api/payments
  app.get('/api/payments', async (_request, reply) => {
    try {
      return await app.kaleidoService.listPayments()
    } catch (error) {
      app.log.warn({ error }, 'Payments unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })

  app.get('/api/wallet/transfers', async (_request, reply) => {
    try {
      return await app.kaleidoService.listTransfers()
    } catch (error) {
      app.log.warn({ error }, 'Wallet transfers unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })

  // Alias /api/transfers
  app.get('/api/transfers', async (_request, reply) => {
    try {
      return await app.kaleidoService.listTransfers()
    } catch (error) {
      app.log.warn({ error }, 'Transfers unavailable')
      return reply.code(503).send({ error: 'Node unavailable' })
    }
  })
}
