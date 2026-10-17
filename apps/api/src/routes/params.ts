import type { FastifyInstance } from 'fastify'

interface TargetAllocationBody {
  btc: number
  xaut: number
  usdt: number
}

const targetAllocationSchema = {
  body: {
    type: 'object',
    required: ['btc', 'xaut', 'usdt'],
    properties: {
      btc: { type: 'integer', minimum: 0, maximum: 100 },
      xaut: { type: 'integer', minimum: 0, maximum: 100 },
      usdt: { type: 'integer', minimum: 0, maximum: 100 },
    },
    additionalProperties: false,
  },
}

export function registerParamsRoutes(app: FastifyInstance) {
  // GET current target allocation
  app.get('/api/params/target-allocation', async () => {
    const record = app.paramsStore.getTargetAllocation()
    return {
      target: {
        btc: record.btc,
        xaut: record.xaut,
        usdt: record.usdt,
      },
      updatedAt: record.updatedAt,
    }
  })

  // PUT / POST update target allocation
  const updateHandler = async (request: { body: TargetAllocationBody }) => {
    const { btc, xaut, usdt } = request.body
    const record = app.paramsStore.setTargetAllocation({ btc, xaut, usdt })
    return {
      target: {
        btc: record.btc,
        xaut: record.xaut,
        usdt: record.usdt,
      },
      updatedAt: record.updatedAt,
    }
  }

  app.put<{ Body: TargetAllocationBody }>(
    '/api/params/target-allocation',
    { schema: targetAllocationSchema },
    updateHandler,
  )

  app.post<{ Body: TargetAllocationBody }>(
    '/api/params/target-allocation',
    { schema: targetAllocationSchema },
    updateHandler,
  )
}
