import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search,
  X,
  Ruler,
  Package,
  Tag,
  FileText,
  PlusCircle,
  AlertCircle,
  ChevronRight,
  User,
  Check,
} from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import {
  fetchAllCustomers,
  fetchCustomerWithOrders,
  fetchOrderById,
  transformCustomer,
  formatDate,
  formatCurrency,
  clearOrdersCache,
} from '../lib/shopify'
import { cn } from '../utils/cn'

// Same categorize logic as OrderDetail — splits attrs into display sections
function categorize(customAttributes = []) {
  const general = [],
    measurements = [],
    vest = []
  for (const attr of customAttributes) {
    if (attr.key.startsWith('_')) continue
    if (attr.key.startsWith('Vest ')) {
      vest.push({ key: attr.key.replace('Vest ', ''), originalKey: attr.key, value: attr.value })
    } else if (attr.value && /^\d/.test(attr.value)) {
      measurements.push({ key: attr.key, originalKey: attr.key, value: attr.value })
    } else {
      general.push({ key: attr.key, originalKey: attr.key, value: attr.value })
    }
  }
  return { general, measurements, vest }
}

// ─── Customer Selector ──────────────────────────────────────────────────────
function CustomerSelector({ customers, value, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return customers
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
      )
      .slice(0, 20)
  }, [customers, search])

  if (value) {
    return (
      <div className="flex items-center gap-[12px] p-[14px] border border-border rounded-lg bg-white">
        <div className="w-[40px] h-[40px] bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-16 font-bold">{value.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary text-15">{value.name}</p>
          {value.email && <p className="text-12 text-text-muted">{value.email}</p>}
        </div>
        <span className="text-12 text-text-muted mr-[8px]">{value.numberOfOrders} orders</span>
        <button onClick={() => onChange(null)} className="btn-icon" title="Change customer">
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder="Search customer by name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="input pl-[38px]"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-[4px] bg-white border border-border rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-[16px] text-14 text-text-muted text-center">No customers found</div>
          ) : (
            filtered.map((customer) => (
              <button
                key={customer.id}
                onClick={() => {
                  onChange(customer)
                  setOpen(false)
                  setSearch('')
                }}
                className="w-full flex items-center gap-[10px] px-[14px] py-[10px] hover:bg-gray-50 text-left transition-colors border-b border-border-light last:border-b-0"
              >
                <div className="w-[32px] h-[32px] bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-12 font-bold">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-14 font-medium text-text-primary">{customer.name}</p>
                  {customer.email && (
                    <p className="text-12 text-text-muted truncate">{customer.email}</p>
                  )}
                </div>
                <span className="text-12 text-text-muted flex-shrink-0">
                  {customer.numberOfOrders} orders
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Line Item Editor ───────────────────────────────────────────────────────
function LineItemEditor({ item, onChange }) {
  const { general, measurements, vest } = useMemo(
    () => categorize(item.attributes),
    [item.attributes]
  )

  function updateAttr(originalKey, value) {
    onChange({
      ...item,
      attributes: item.attributes.map((a) => (a.key === originalKey ? { ...a, value } : a)),
    })
  }

  return (
    <div className="space-y-[16px]">
      {/* Product info */}
      <div className="card p-[20px]">
        <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted mb-[16px]">
          Product Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          <div>
            <label className="input-label">Product Name</label>
            <input
              type="text"
              value={item.title}
              onChange={(e) => onChange({ ...item, title: e.target.value })}
              className="input"
              placeholder="e.g. Bespoke Suit"
            />
          </div>
          <div>
            <label className="input-label">Price (store currency)</label>
            <input
              type="number"
              value={item.price}
              onChange={(e) => onChange({ ...item, price: e.target.value })}
              className="input"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
        </div>
      </div>

      {/* General attributes */}
      {general.length > 0 && (
        <div className="card overflow-hidden border-l-4 border-gray-300">
          <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
            <Tag size={14} className="text-text-muted" />
            <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">Details</h3>
            <span className="ml-auto text-11 text-text-muted">{general.length} fields</span>
          </div>
          <div className="p-[20px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[14px]">
            {general.map(({ key, originalKey }) => (
              <div key={originalKey}>
                <label className="input-label">{key}</label>
                <input
                  type="text"
                  value={item.attributes.find((a) => a.key === originalKey)?.value || ''}
                  onChange={(e) => updateAttr(originalKey, e.target.value)}
                  className="input"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Measurements */}
      {measurements.length > 0 && (
        <div className="card overflow-hidden border-l-4 border-brand-600">
          <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
            <Ruler size={14} className="text-brand-700" />
            <h3 className="text-13 font-bold uppercase tracking-wider text-brand-700">
              Measurements
            </h3>
            <span className="ml-auto text-11 font-semibold text-brand-700 bg-brand-50 px-[8px] py-[2px] rounded-full">
              {measurements.length} measurements
            </span>
          </div>
          <div className="p-[16px] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[10px]">
            {measurements.map(({ key, originalKey }) => (
              <div key={originalKey}>
                <label className="input-label text-11">{key}</label>
                <input
                  type="text"
                  value={item.attributes.find((a) => a.key === originalKey)?.value || ''}
                  onChange={(e) => updateAttr(originalKey, e.target.value)}
                  className="input py-[8px] text-15 font-bold"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vest measurements */}
      {vest.length > 0 && (
        <div className="card overflow-hidden border-l-4 border-pending">
          <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
            <Package size={14} className="text-pending" />
            <h3 className="text-13 font-bold uppercase tracking-wider text-pending">
              Vest Measurements
            </h3>
            <span className="ml-auto text-11 font-semibold text-pending bg-pending-bg px-[8px] py-[2px] rounded-full">
              {vest.length} measurements
            </span>
          </div>
          <div className="p-[16px] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[10px]">
            {vest.map(({ key, originalKey }) => (
              <div key={originalKey}>
                <label className="input-label text-11">{key}</label>
                <input
                  type="text"
                  value={item.attributes.find((a) => a.key === originalKey)?.value || ''}
                  onChange={(e) => updateAttr(originalKey, e.target.value)}
                  className="input py-[8px] text-15 font-bold"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function CreateOrder() {
  const navigate = useNavigate()

  const [customers, setCustomers] = useState([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerOrders, setCustomerOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [selectedOrderGid, setSelectedOrderGid] = useState(null)
  const [orderLoading, setOrderLoading] = useState(false)
  const [lineItems, setLineItems] = useState([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Load all customers once on mount
  useEffect(() => {
    fetchAllCustomers()
      .then((raw) => {
        setCustomers(raw.map(transformCustomer))
        setCustomersLoading(false)
      })
      .catch(() => setCustomersLoading(false))
  }, [])

  // When customer changes → fetch their orders
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerOrders([])
      setSelectedOrderGid(null)
      setLineItems([])
      setNote('')
      return
    }
    setOrdersLoading(true)
    setCustomerOrders([])
    setSelectedOrderGid(null)
    setLineItems([])
    fetchCustomerWithOrders(selectedCustomer.id)
      .then((data) => {
        const orders = data.allOrders // sorted newest first (reverse: true)
        setCustomerOrders(orders)
        setOrdersLoading(false)
        if (orders.length > 0) setSelectedOrderGid(orders[0].id) // auto-select latest
      })
      .catch(() => setOrdersLoading(false))
  }, [selectedCustomer])

  // When order selected → fetch full details to pre-fill form
  useEffect(() => {
    if (!selectedOrderGid) return
    setOrderLoading(true)
    setLineItems([])
    fetchOrderById(selectedOrderGid)
      .then((order) => {
        const items = order.lineItems?.edges?.map((e) => e.node) ?? []
        setLineItems(
          items.map((item) => ({
            title: item.title || '',
            price: item.originalUnitPriceSet?.shopMoney?.amount || '0.00',
            attributes: (item.customAttributes || []).filter((a) => !a.key.startsWith('_')),
          }))
        )
        setNote(order.note || '')
        setOrderLoading(false)
      })
      .catch(() => setOrderLoading(false))
  }, [selectedOrderGid])

  function updateLineItem(idx, updated) {
    setLineItems((prev) => prev.map((item, i) => (i === idx ? updated : item)))
  }

  async function handleSubmit() {
    if (!selectedCustomer || lineItems.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          lineItems: lineItems.map((item) => ({
            title: item.title,
            quantity: 1,
            originalUnitPrice: item.price || '0.00',
            customAttributes: item.attributes,
          })),
          note,
          tags: ['admin-created'],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create order')
      clearOrdersCache()
      navigate(`/orders/${data.orderId}`)
    } catch (err) {
      setSubmitError(err.message)
      setSubmitting(false)
    }
  }

  const canSubmit = !!selectedCustomer && lineItems.length > 0 && !submitting

  return (
    <DashboardLayout>
      {/* Back */}
      <div className="mb-[20px]">
        <Link
          to="/orders"
          className="inline-flex items-center gap-[6px] text-13 text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Orders
        </Link>
      </div>

      {/* Page header */}
      <div className="section-header mb-[24px]">
        <div>
          <h2 className="text-24 font-bold text-text-primary">Create New Order</h2>
          <p className="text-14 text-text-muted mt-[3px]">
            Select a customer, pick a previous order as template, then adjust and create
          </p>
        </div>
      </div>

      <div className="space-y-[20px]">
        {/* ── Step 1: Customer ── */}
        <div className="card">
          <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
            <div className="w-[20px] h-[20px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-11 font-bold">1</span>
            </div>
            <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
              Select Customer
            </h3>
          </div>
          <div className="p-[20px]">
            {customersLoading ? (
              <p className="text-14 text-text-muted">Loading customers…</p>
            ) : (
              <CustomerSelector
                customers={customers}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
              />
            )}
          </div>
        </div>

        {/* ── Step 2: Order History ── */}
        {selectedCustomer && (
          <div className="card overflow-hidden">
            <div className="flex items-center gap-[8px] px-[20px] py-[13px] border-b border-border bg-gray-50">
              <div className="w-[20px] h-[20px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-11 font-bold">2</span>
              </div>
              <h3 className="text-13 font-bold uppercase tracking-wider text-text-muted">
                Previous Orders
              </h3>
              {!ordersLoading && (
                <span className="ml-auto text-12 text-text-muted">
                  {customerOrders.length} order{customerOrders.length !== 1 ? 's' : ''} — click row
                  to use as template
                </span>
              )}
            </div>

            {ordersLoading ? (
              <div className="p-[24px]">
                <LoadingState message="Loading orders…" />
              </div>
            ) : customerOrders.length === 0 ? (
              <div className="py-[32px] text-center text-text-muted text-14">
                No previous orders. Fill in all details manually below.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrders.map((order, idx) => {
                      const isSelected = order.id === selectedOrderGid
                      const isLatest = idx === 0
                      return (
                        <tr
                          key={order.id}
                          onClick={() => setSelectedOrderGid(order.id)}
                          className={cn(
                            'cursor-pointer transition-colors',
                            isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td>
                            <div className="flex items-center gap-[8px]">
                              {isSelected && (
                                <Check size={13} className="text-brand-600 flex-shrink-0" />
                              )}
                              <span
                                className={cn(
                                  'font-bold',
                                  isSelected ? 'text-brand-600' : 'text-text-primary'
                                )}
                              >
                                {order.name}
                              </span>
                              {isLatest && (
                                <span className="text-[10px] font-semibold bg-brand-100 text-brand-700 px-[6px] py-[1px] rounded-full">
                                  Latest
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-text-secondary whitespace-nowrap">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="text-text-secondary">
                            {order.lineItems?.edges?.length || 0} item
                            {order.lineItems?.edges?.length !== 1 ? 's' : ''}
                          </td>
                          <td className="font-semibold text-text-primary">
                            {formatCurrency(order.totalPriceSet)}
                          </td>
                          <td>
                            <Badge
                              status={
                                order.displayFinancialStatus === 'REFUNDED' ||
                                order.displayFinancialStatus === 'VOIDED'
                                  ? 'failed'
                                  : order.displayFulfillmentStatus === 'FULFILLED'
                                    ? 'submitted'
                                    : 'pending'
                              }
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Order Form ── */}
        {selectedCustomer && selectedOrderGid && (
          <div className="space-y-[16px]">
            <div className="flex items-center gap-[8px]">
              <div className="flex-1 h-[1px] bg-border" />
              <div className="flex items-center gap-[8px] px-[12px]">
                <div className="w-[20px] h-[20px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-11 font-bold">3</span>
                </div>
                <span className="text-12 font-bold uppercase tracking-wider text-text-muted">
                  Edit &amp; Create Order
                </span>
              </div>
              <div className="flex-1 h-[1px] bg-border" />
            </div>

            {orderLoading ? (
              <div className="card p-[24px]">
                <LoadingState message="Loading order details…" />
              </div>
            ) : lineItems.length === 0 ? (
              <div className="card p-[24px] text-center text-text-muted text-14">
                No line items found in this order.
              </div>
            ) : (
              <>
                {lineItems.map((item, idx) => (
                  <div key={idx}>
                    {lineItems.length > 1 && (
                      <div className="flex items-center gap-[8px] mb-[12px]">
                        <div className="flex-1 h-[1px] bg-border" />
                        <span className="text-12 text-text-muted font-semibold uppercase tracking-wider px-[8px]">
                          Item {idx + 1}
                        </span>
                        <div className="flex-1 h-[1px] bg-border" />
                      </div>
                    )}
                    <LineItemEditor
                      item={item}
                      onChange={(updated) => updateLineItem(idx, updated)}
                    />
                  </div>
                ))}

                {/* Note */}
                <div className="card p-[20px]">
                  <div className="flex items-center gap-[8px] mb-[12px]">
                    <FileText size={14} className="text-text-muted" />
                    <h3 className="text-13 font-semibold text-text-primary">Order Note</h3>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Add a note for this order…"
                    className="input resize-none"
                  />
                </div>

                {/* Error */}
                {submitError && (
                  <div className="flex items-start gap-[10px] px-[16px] py-[12px] bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-[1px]" />
                    <div>
                      <p className="text-13 font-semibold text-red-700">Failed to create order</p>
                      <p className="text-12 text-red-600 mt-[2px]">{submitError}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-[10px] pb-[8px]">
                  <Link to="/orders" className="btn-secondary">
                    Cancel
                  </Link>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="btn-primary gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusCircle size={15} />
                    {submitting ? 'Creating Order…' : 'Create Order'}
                    {!submitting && <ChevronRight size={14} />}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty state — no customer selected */}
        {!selectedCustomer && !customersLoading && (
          <div className="card p-[48px] text-center">
            <User size={32} className="mx-auto text-text-muted mb-[12px]" />
            <p className="text-16 font-semibold text-text-primary mb-[4px]">
              Select a customer to start
            </p>
            <p className="text-14 text-text-muted">
              Choose a customer to load their order history and auto-fill measurements
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
