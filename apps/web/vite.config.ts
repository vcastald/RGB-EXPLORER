import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../../', import.meta.url))
  const env = loadEnv(mode, envDir, '')
  const apiPort = env.API_PORT || '3101'
  const webPort = Number(env.WEB_PORT || 5173)

  return {
    envDir,
    envPrefix: ['VITE_', 'API_', 'WEB_', 'RGB_'],
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: webPort,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
