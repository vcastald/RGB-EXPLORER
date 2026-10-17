import { createApp } from './app.js'

const app = createApp()

try {
  await app.listen({ port: Number(process.env.PORT) || 3101, host: '127.0.0.1' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
