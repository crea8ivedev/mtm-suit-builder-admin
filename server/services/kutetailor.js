import { config } from '../config.js'

function buildPayload(order) {
  const firstName = order.customer?.firstName ?? ''
  const lastName = order.customer?.lastName ?? ''
  const lineItems = order.lineItems?.edges?.map((e) => e.node) ?? []

  return {
    reference_id: order.name,
    shopify_order_id: order.id,
    customer: {
      name: `${firstName} ${lastName}`.trim(),
      email: order.customer?.email ?? '',
      phone: order.customer?.phone ?? '',
    },
    garments: lineItems.map((item) => {
      const measurements = {}
      ;(item.customAttributes ?? [])
        .filter((a) => !a.key.startsWith('_'))
        .forEach((a) => {
          measurements[a.key] = a.value
        })
      return {
        product_name: item.title,
        quantity: item.quantity,
        measurements,
      }
    }),
  }
}

export async function sendToKutetailor(order) {
  const payload = buildPayload(order)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.kutetailor.timeout)

  try {
    const res = await fetch(`${config.kutetailor.apiUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.kutetailor.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg = body?.message ?? body?.error ?? `HTTP ${res.status}`
      throw new Error(msg)
    }

    return { payload, response: body }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out (30s)')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
