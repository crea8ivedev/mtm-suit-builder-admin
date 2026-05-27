import { Router } from 'express'

export const SUPPLIERS = [
  {
    id: 'kutetailor',
    name: 'Kutetailor',
    apiUrl: 'https://platform.kutetailor.com/api',
    enabled: true,
  },
  // Add future suppliers here
]

const router = Router()

router.get('/', (_req, res) => {
  res.json(SUPPLIERS.filter((s) => s.enabled))
})

export default router
