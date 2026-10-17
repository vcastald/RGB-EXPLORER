import { createApp } from './app.js'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)))
const app = createApp()

try {
  await app.listen({ port: Number(process.env.API_PORT ?? 3101), host: '127.0.0.1' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
