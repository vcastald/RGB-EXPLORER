import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type DepositAddress = {
  address: string
  nodePubkey: string
  network: string
  createdAt: string
}

export class AddressStorageError extends Error {}

export interface AddressStore {
  save(record: DepositAddress): void
  list(nodePubkey: string, network: string): DepositAddress[]
}

export class SqliteAddressStore implements AddressStore {
  private readonly db: DatabaseSync

  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(filename)
    this.db.exec(`CREATE TABLE IF NOT EXISTS deposit_addresses (
      address TEXT PRIMARY KEY,
      node_pubkey TEXT NOT NULL,
      network TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`)
  }

  save(record: DepositAddress) {
    try {
      this.db.prepare(`INSERT INTO deposit_addresses (address, node_pubkey, network, created_at)
        VALUES (?, ?, ?, ?)`).run(record.address, record.nodePubkey, record.network, record.createdAt)
    } catch (error) {
      throw new AddressStorageError('Address could not be recorded', { cause: error })
    }
  }

  list(nodePubkey: string, network: string): DepositAddress[] {
    const rows = this.db.prepare(`SELECT address, node_pubkey AS nodePubkey, network, created_at AS createdAt
      FROM deposit_addresses WHERE node_pubkey = ? AND network = ? ORDER BY created_at DESC, address DESC`)
      .all(nodePubkey, network)
    return rows.map((row) => ({
      address: String(row.address), nodePubkey: String(row.nodePubkey),
      network: String(row.network), createdAt: String(row.createdAt),
    }))
  }

  close() { this.db.close() }
}
