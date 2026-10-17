import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface TargetAllocationRecord {
  btc: number
  xaut: number
  usdt: number
  updatedAt: string
}

export interface ParamsStore {
  getTargetAllocation(): TargetAllocationRecord
  setTargetAllocation(allocation: { btc: number; xaut: number; usdt: number }): TargetAllocationRecord
  close(): void
}

export class SqliteParamsStore implements ParamsStore {
  private readonly db: DatabaseSync

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
    }
    this.db = new DatabaseSync(filename)
    this.init()
  }

  private init() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS target_allocation (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      btc INTEGER NOT NULL,
      xaut INTEGER NOT NULL,
      usdt INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )`)

    const row = this.db.prepare('SELECT id FROM target_allocation WHERE id = 1').get()
    if (!row) {
      const now = new Date().toISOString()
      this.db.prepare(`INSERT INTO target_allocation (id, btc, xaut, usdt, updated_at)
        VALUES (1, 40, 30, 30, ?)`).run(now)
    }
  }

  getTargetAllocation(): TargetAllocationRecord {
    const row = this.db.prepare(`SELECT btc, xaut, usdt, updated_at AS updatedAt
      FROM target_allocation WHERE id = 1`).get() as { btc: number; xaut: number; usdt: number; updatedAt: string } | undefined

    if (!row) {
      return { btc: 40, xaut: 30, usdt: 30, updatedAt: new Date().toISOString() }
    }

    return {
      btc: Number(row.btc),
      xaut: Number(row.xaut),
      usdt: Number(row.usdt),
      updatedAt: String(row.updatedAt),
    }
  }

  setTargetAllocation(allocation: { btc: number; xaut: number; usdt: number }): TargetAllocationRecord {
    const updatedAt = new Date().toISOString()
    this.db.prepare(`INSERT OR REPLACE INTO target_allocation (id, btc, xaut, usdt, updated_at)
      VALUES (1, ?, ?, ?, ?)`).run(allocation.btc, allocation.xaut, allocation.usdt, updatedAt)

    return {
      btc: allocation.btc,
      xaut: allocation.xaut,
      usdt: allocation.usdt,
      updatedAt,
    }
  }

  close() {
    this.db.close()
  }
}
