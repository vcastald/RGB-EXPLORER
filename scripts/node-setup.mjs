import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'
import { KaleidoClient } from 'kaleido-sdk'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
loadEnvFile(path.join(root, '.env'))
process.umask(0o077)
const dir = path.join(root, '.local-node')
const passwordFile = path.join(dir, 'password')
const mnemonicFile = path.join(dir, 'mnemonic')
const markerFile = path.join(dir, 'initialized')
const nodeUrl = `http://127.0.0.1:${process.env.RGB_NODE_PORT ?? '3901'}`
const indexer = 'https://esplora.signet.kaleidoswap.com'

async function main() {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  // Never initialize into an existing data directory without our marker.
  if (!fs.existsSync(markerFile) && fs.existsSync(path.join(dir, 'data')) && fs.readdirSync(path.join(dir, 'data')).length) {
    throw new Error('Node data exists without setup marker. Do not reset it; inspect .local-node first.')
  }
  if (!fs.existsSync(markerFile) && (fs.existsSync(passwordFile) || fs.existsSync(mnemonicFile))) {
    throw new Error('Incomplete previous setup. Do not retry initialization blindly; inspect .local-node first.')
  }
  if (fs.existsSync(markerFile) && (!fs.existsSync(passwordFile) || !fs.existsSync(path.join(dir, 'data')) || !fs.readdirSync(path.join(dir, 'data')).length)) {
    throw new Error('Wallet marker exists but password or node data is missing. Refusing to start a replacement wallet.')
  }
  console.log('Starting isolated Mutinynet node…')
  execFileSync('docker', ['compose', '-f', 'compose.node.yaml', 'up', '-d'], { stdio: 'inherit' })
  const client = KaleidoClient.create({ nodeUrl, baseUrl: 'https://api.signet.kaleidoswap.com', timeout: 10 })
  try {
    let ready = false
    for (let i = 0; i < 30; i++) {
      try {
        const response = await fetch(nodeUrl + '/docs', { signal: AbortSignal.timeout(1500) })
        if (response.status < 500) { ready = true; break }
      } catch { /* still starting */ }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    if (!ready) throw new Error('Node API did not become ready; check docker compose -f compose.node.yaml logs')

    let password
    if (!fs.existsSync(markerFile)) {
      password = randomBytes(32).toString('hex')
      fs.writeFileSync(passwordFile, password, { flag: 'wx', mode: 0o600 })
      // If init succeeds but saving fails, the presence of password blocks any automatic retry.
      const response = await client.rln.initWallet({ password })
      fs.writeFileSync(mnemonicFile, response.mnemonic + '\n', { flag: 'wx', mode: 0o600 })
      fs.writeFileSync(markerFile, 'initialized\n', { flag: 'wx', mode: 0o600 })
      console.log('New wallet created. Back up .local-node/mnemonic OFFLINE and preserve .local-node/data for RGB/channel recovery.')
    } else {
      password = fs.readFileSync(passwordFile, 'utf8').trim()
    }
    try {
      await client.rln.unlockWallet({ password, ldk_chain_sync: { mode: 'TransactionSync', config: { indexer_url: indexer } }, indexer_url: indexer, announce_addresses: [], announce_alias: 'rgb-explorer' })
    } catch (error) {
      // Already unlocked is fine; confirm by querying the node below.
      if (!/already (?:been )?unlocked/i.test(String(error))) throw error
    }
    const network = await client.rln.getNetworkInfo()
    if (network.network.toLowerCase() !== 'signetcustom') throw new Error(`Unexpected network: ${network.network}`)
    const info = await client.rln.getNodeInfo()
    console.log(`Ready: ${network.network}; node pubkey: ${info.pubkey}`)
  } finally {
    await client.close()
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
