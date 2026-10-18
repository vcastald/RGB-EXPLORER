import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface RgbReceipt {
  recipientId: string
  nodePubkey: string
  expectedAssetId: string
  assetAmount: number | null
  expirationTimestamp: number
}
export class RgbReceiptStore {
  private readonly db: DatabaseSync
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(filename)
    this.db.exec('CREATE TABLE IF NOT EXISTS rgb_receipts (node TEXT NOT NULL, recipient TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(node, recipient))')
  }
  save(record: RgbReceipt) {
    this.db.prepare('INSERT INTO rgb_receipts VALUES (?, ?, ?)').run(record.nodePubkey, record.recipientId, JSON.stringify(record))
  }
  get(node: string, recipient: string): RgbReceipt | undefined {
    const row = this.db.prepare('SELECT record FROM rgb_receipts WHERE node = ? AND recipient = ?').get(node, recipient)
    return row ? JSON.parse(String(row.record)) as RgbReceipt : undefined
  }
  close() { this.db.close() }
}
