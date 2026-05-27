import { Router } from 'express'
import {
  createCustomer,
  setCustomerProductsMetafield,
  syncAllCustomerProfiles,
} from '../services/shopify.js'

const router = Router()

router.post('/', async (req, res) => {
  const { firstName, lastName, email, phone } = req.body

  if (!firstName?.trim())
    return res.status(400).json({ error: 'First name is required', field: 'firstName' })
  if (!lastName?.trim())
    return res.status(400).json({ error: 'Last name is required', field: 'lastName' })
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required', field: 'email' })

  console.log(`[customers] creating ${email}`)

  try {
    const customer = await createCustomer({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone?.trim(),
    })
    console.log(`[customers] created ${customer.id}`)
    return res.json({ success: true, customer })
  } catch (err) {
    console.error('[customers] create failed:', err.message)
    const status = err.field ? 422 : 502
    return res.status(status).json({ error: err.message, field: err.field ?? null })
  }
})

let syncLock = false

// POST /api/customers/sync-all
router.post('/sync-all', async (req, res) => {
  if (syncLock) {
    return res.json({ success: true, synced: 0, skipped: 0, total: 0, locked: true })
  }
  syncLock = true
  const { since } = req.body ?? {}
  console.log('[customers] sync-all started', since ? `since ${since}` : '(full)')
  try {
    const result = await syncAllCustomerProfiles(since || null)
    console.log(`[customers] sync-all done: ${JSON.stringify(result)}`)
    return res.json({ success: true, ...result })
  } catch (err) {
    console.error('[customers] sync-all failed:', err.message)
    return res.status(500).json({ error: err.message })
  } finally {
    syncLock = false
  }
})

// POST /api/customers/:id/sync-products
// Saves unique ordered products to profiles.gc_measurements metafield
router.post('/:id/sync-products', async (req, res) => {
  const customerGid = `gid://shopify/Customer/${req.params.id}`
  const { data } = req.body

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'data object required' })
  }

  try {
    await setCustomerProductsMetafield(customerGid, data)
    const count = Object.values(data).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0)
    console.log(`[customers] synced ${count} profiles → ${customerGid}`)
    return res.json({ success: true, count })
  } catch (err) {
    console.error('[customers] sync-products failed:', err.message)
    return res.status(502).json({ error: err.message })
  }
})

export default router
