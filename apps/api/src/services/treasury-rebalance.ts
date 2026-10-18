export interface TargetAllocation {
  btc: number
  xaut: number
  usdt: number
}

export interface TreasuryValues {
  btc: number
  xaut: number
  usdt: number
}

export interface RebalanceItem {
  asset: keyof TargetAllocation
  currentValue: number
  targetValue: number
  difference: number
  action: 'buy' | 'sell' | 'hold'
}

export interface RebalancePlan {
  totalValue: number
  items: RebalanceItem[]
}

interface TargetAllocationStore {
  getTargetAllocation(): TargetAllocation & { updatedAt?: string }
}

/** Read the saved allocation from the existing SQLite-backed store. */
export function getTargetAllocation(
  store: TargetAllocationStore,
): TargetAllocation {
  const record = store.getTargetAllocation()

  const target: TargetAllocation = {
    btc: record.btc,
    xaut: record.xaut,
    usdt: record.usdt,
  }

  const percentages = [target.btc, target.xaut, target.usdt]

  if (
    percentages.some(
      value => !Number.isInteger(value) || value < 0 || value > 100,
    ) ||
    percentages.reduce((sum, value) => sum + value, 0) !== 100
  ) {
    throw new Error('I target salvati devono essere interi tra 0 e 100 e totalizzare il 100%')
  }

  return target
}

/** Compare current portfolio values with the saved target allocation. */
export function calculateRebalance(
  target: TargetAllocation,
  current: TreasuryValues,
): RebalancePlan {
  const assets = ['btc', 'xaut', 'usdt'] as const

  const percentages = assets.map(asset => target[asset])

  if (
    percentages.some(
      value => !Number.isInteger(value) || value < 0 || value > 100,
    ) ||
    percentages.reduce((sum, value) => sum + value, 0) !== 100
  ) {
    throw new Error('I target devono essere interi tra 0 e 100 e totalizzare il 100%')
  }

  for (const asset of assets) {
    if (!Number.isFinite(current[asset]) || current[asset] < 0) {
      throw new Error(`Valore corrente non valido per ${asset}`)
    }
  }

  const totalValue = assets.reduce((sum, asset) => sum + current[asset], 0)

  if (totalValue <= 0) {
    throw new Error('Il valore totale del treasury deve essere positivo')
  }

  const items = assets.map((asset): RebalanceItem => {
    const currentValue = current[asset]
    const targetValue = totalValue * target[asset] / 100
    const difference = targetValue - currentValue

    return {
      asset,
      currentValue,
      targetValue,
      difference,
      action:
        difference > 0.01
          ? 'buy'
          : difference < -0.01
            ? 'sell'
            : 'hold',
    }
  })

  return { totalValue, items }
}