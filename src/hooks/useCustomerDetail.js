import { useState, useEffect, useCallback } from 'react'
import {
  fetchCustomerWithOrders,
  clearCustomerDetailCache,
  transformCustomer,
} from '../lib/shopify'

export function useCustomerDetail(shopifyGid) {
  const [customer, setCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    if (!shopifyGid) return
    setLoading(true)
    setError(null)
    fetchCustomerWithOrders(shopifyGid)
      .then((data) => {
        const { allOrders, ...info } = data
        setCustomer(transformCustomer(info))
        setOrders(allOrders)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [shopifyGid])

  useEffect(() => {
    load()
  }, [load])

  const refetch = useCallback(() => {
    clearCustomerDetailCache(shopifyGid)
    load()
  }, [shopifyGid, load])

  return { customer, orders, loading, error, refetch }
}
