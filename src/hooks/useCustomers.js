import { useState, useEffect, useCallback } from 'react'
import { fetchAllCustomers, clearCustomersCache, transformCustomer } from '../lib/shopify'

export function useCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAllCustomers(setProgress)
      .then((raw) => {
        setCustomers(raw.map(transformCustomer))
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const retry = useCallback(() => {
    clearCustomersCache()
    load()
  }, [load])

  return { customers, loading, error, progress, retry }
}
