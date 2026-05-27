export const config = {
  shopify: {
    storeDomain: process.env.VITE_SHOPIFY_STORE_DOMAIN,
    accessToken: process.env.VITE_SHOPIFY_ACCESS_TOKEN,
    apiVersion: '2024-01',
  },
  kutetailor: {
    apiUrl: process.env.KUTETAILOR_API_URL ?? 'https://platform.kutetailor.com/api',
    apiKey: process.env.KUTETAILOR_API_KEY ?? '',
    timeout: 30_000,
  },
  email: {
    host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT ?? 587),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER ?? '',
    pass: process.env.EMAIL_PASS ?? '',
    from: process.env.EMAIL_FROM ?? 'SuitAdmin <noreply@suitadmin.com>',
  },
  port: Number(process.env.PORT ?? 3002),
}
