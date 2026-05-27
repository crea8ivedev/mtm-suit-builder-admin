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
        '/api/auth': {
          target: 'http://localhost:3002',
          changeOrigin: true,
        },
        '/api/suppliers': {
          target: 'http://localhost:3002',
          changeOrigin: true,
        },
        '/api/orders': {
          target: 'http://localhost:3002',
          changeOrigin: true,
        },
        '/api/customers': {
          target: 'http://localhost:3002',
          changeOrigin: true,
        },
      },
    },
  }
})
