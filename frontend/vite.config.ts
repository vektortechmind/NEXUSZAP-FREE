import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiTarget = env.VITE_DEV_API_TARGET || "http://127.0.0.1:3000"

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      /** Mesma origem que o painel: evita CORS e cookies bloqueados ao falar com o Fastify. */
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true
        },
        "/ws/chat": {
          target: apiTarget,
          changeOrigin: true,
          ws: true
        }
      }
    }
  }
})
