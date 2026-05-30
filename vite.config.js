import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [tailwindcss(), react()],
    server: {
      allowedHosts: true,
      proxy: {
        '/api/shopify': {
          target: env.VITE_SHOPIFY_STORE_DOMAIN || 'https://placeholder.myshopify.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/shopify/, '/admin/api/2025-01'),
          headers: {
            'X-Shopify-Access-Token': env.VITE_SHOPIFY_ACCESS_TOKEN || '',
          },
        },
        '/api/kt': {
          target: env.VITE_KUTETAILOR_API_URL
            ? new URL(env.VITE_KUTETAILOR_API_URL).origin
            : 'https://platform.kutetailor.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/kt/, '/api'),
        },
      },
    },
  }
})
