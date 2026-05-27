import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import supplierRoutes from './routes/suppliers.js'
import orderRoutes from './routes/orders.js'
import customerRoutes from './routes/customers.js'
import authRoutes from './routes/auth.js'

const app = express()

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/customers', customerRoutes)

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`))
