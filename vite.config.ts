import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    env.VITE_PULSE_API_PROXY_TARGET || env.VITE_PULSE_API_BASE_URL || 'http://127.0.0.1:8789'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': proxyTarget,
        '/v1': proxyTarget,
      },
    },
  }
})
