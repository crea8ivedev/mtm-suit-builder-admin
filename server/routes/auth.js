import { Router } from 'express'
import { findCustomerByEmail } from '../services/shopify.js'
import { sendOtpEmail } from '../services/email.js'

const router = Router()

// In-memory OTP store: email → { otp, expiresAt, attempts }
const otpStore = new Map()

const OTP_TTL = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// POST /api/auth/request-otp
// Validates super_admin tag in Shopify, then sends OTP email
router.post('/request-otp', async (req, res) => {
  const { email } = req.body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' })
  }

  try {
    const customer = await findCustomerByEmail(email.toLowerCase().trim())

    if (!customer) {
      return res.status(403).json({ error: 'No admin account found for this email' })
    }

    const tags = (customer.tags || []).map((t) => t.toLowerCase().trim())
    if (!tags.includes('super_admin')) {
      return res.status(403).json({ error: 'No admin account found for this email' })
    }

    const otp = generateOtp()
    otpStore.set(email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + OTP_TTL,
      attempts: 0,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null,
    })

    await sendOtpEmail(email, otp)
    console.log(`[auth] OTP sent to ${email}`)

    return res.json({ success: true, message: 'OTP sent to your email' })
  } catch (err) {
    console.error('[auth] request-otp error:', err.message)
    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' })
  }
})

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' })
  }

  const key = email.toLowerCase().trim()
  const record = otpStore.get(key)

  if (!record) {
    return res.status(401).json({ error: 'OTP expired or not requested. Request a new one.' })
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key)
    return res.status(401).json({ error: 'OTP has expired. Request a new one.' })
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key)
    return res.status(401).json({ error: 'Too many attempts. Request a new OTP.' })
  }

  if (otp.trim() !== record.otp) {
    record.attempts += 1
    const remaining = MAX_ATTEMPTS - record.attempts
    return res.status(401).json({
      error:
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Too many attempts. Request a new OTP.',
    })
  }

  otpStore.delete(key)
  console.log(`[auth] verified: ${email}`)
  return res.json({ success: true, name: record.name })
})

// GET /api/auth/me?email=xxx
// Returns current admin's name + email from Shopify
router.get('/me', async (req, res) => {
  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'Email required' })

  try {
    const customer = await findCustomerByEmail(email.toLowerCase().trim())
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    const tags = (customer.tags || []).map((t) => t.toLowerCase().trim())
    if (!tags.includes('super_admin')) return res.status(403).json({ error: 'Not an admin' })

    return res.json({
      name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null,
      email: customer.email,
    })
  } catch (err) {
    console.error('[auth] me error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch admin info' })
  }
})

export default router
