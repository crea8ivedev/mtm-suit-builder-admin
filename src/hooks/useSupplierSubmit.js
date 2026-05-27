import { useState, useCallback } from 'react'

export function useSupplierSubmit(orderId, onSettled) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const submit = useCallback(
    async (supplierId) => {
      if (!supplierId) return
      setSubmitting(true)
      setSubmitError(null)

      try {
        const res = await fetch(`/api/orders/${orderId}/send-to-supplier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Submission failed')
      } catch (err) {
        setSubmitError(err.message)
      } finally {
        setSubmitting(false)
        onSettled?.()
      }
    },
    [orderId, onSettled]
  )

  const retry = useCallback((supplierId) => submit(supplierId), [submit])

  return { submit, retry, submitting, submitError }
}
