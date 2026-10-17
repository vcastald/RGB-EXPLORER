import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, fsyncSync, closeSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

export function readJournal(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

export function saveJournal(file, journal, first = false) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const body = JSON.stringify(journal, null, 2) + '\n'
  if (first) {
    const fd = openSync(file, 'wx', 0o600)
    try { writeFileSync(fd, body); fsyncSync(fd) } finally { closeSync(fd) }
  } else {
    const tmp = `${file}.${process.pid}.tmp`
    const fd = openSync(tmp, 'wx', 0o600)
    try { writeFileSync(fd, body); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(tmp, file)
  }
}

export function nextChannel(journal) {
  return journal?.channels?.BTC ? null : 'BTC'
}

export function requireKnownOrder(journal, ticker) {
  const entry = journal?.channels?.[ticker]
  if (!entry?.orderId || !entry?.accessToken) {
    throw Error(`${ticker} order has no saved ID/token. Submission may have succeeded; do not retry or delete the journal. Investigate with the LSP.`)
  }
  return entry
}
