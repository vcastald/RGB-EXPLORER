import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import WalletManagerTron from '@tetherto/wdk-wallet-tron'
import WalletManagerBtc from '@tetherto/wdk-wallet-btc'

console.log('Starting WDK App...')

const seedPhrase = WDK.getRandomSeedPhrase()
console.log('Generated seed phrase:', seedPhrase)

console.log('Registering wallets...')

const wdkWithWallets = new WDK(seedPhrase)
  .registerWallet('bitcoin', WalletManagerBtc, {
    network: 'mainnet',
    host: 'electrum.blockstream.info',
    port: 50001
  })

console.log('Wallets registered for Bitcoin')

const accounts = {
  bitcoin: await wdkWithWallets.getAccount('bitcoin', 0)
}

console.log('Resolving addresses:')

for (const [chain, account] of Object.entries(accounts)) {
  const address = await account.getAddress()
  console.log(`   ${chain.toUpperCase()}: ${address}`)
}

console.log('Checking balances...')

for (const [chain, account] of Object.entries(accounts)) {
  const balance = await account.getBalance()
  console.log(`   ${chain.toUpperCase()}: ${balance.toString()} units`)
}

console.log('Application completed successfully!')

for (const [chain, account] of Object.entries(accounts)) {
  const quote = await account.quoteSendTransaction({
    to: await account.getAddress(),
    value: chain === 'bitcoin' ? 100000000n : chain === 'tron' ? 1000000n : 1000000000000000000n
  })
  console.log(`   ${chain.toUpperCase()}: ${quote.fee.toString()} units`)
}

const result = await accounts[bitcoin].sendTransaction({
  to: '0x742d35Cc6634C05...a3b8D9C5c8b7b6e5f6e5',
  value: 1000000000000000000n  // INSUFFICIENT_BALANCE --> never received a utxo
})

console.log('Transaction hash:', result.hash)

// Close all wallet connections so the program can exit
wdkWithWallets.dispose()

