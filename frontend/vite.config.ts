import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.API_URL || 'http://backend:3000'
  const socketUrl = env.SOCKET_URL || env.API_URL?.replace('/app-api', '') + '/ws' || 'http://backend:3000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/app-api': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/app-api/, ''),
        },
        '/app-socket': {
          target: socketUrl,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/app-socket/, ''),
        },
      },
    },
  }
})
