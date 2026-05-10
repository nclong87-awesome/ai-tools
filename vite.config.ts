import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET?.trim() || 'http://localhost:8888'
  const configuredBasePath = env.VITE_BASE_PATH?.trim()
  const basePath =
    configuredBasePath && configuredBasePath.length > 0
      ? configuredBasePath.endsWith('/')
        ? configuredBasePath
        : `${configuredBasePath}/`
      : '/'

  return {
    base: basePath,
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
