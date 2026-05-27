import { useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Ruler,
  ChevronDown,
  Pencil,
  Save,
  X,
} from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import Badge from '../components/ui/Badge'
import LoadingState from '../components/ui/LoadingState'
import ErrorState from '../components/ui/ErrorState'
import { useCustomerDetail } from '../hooks/useCustomerDetail'
import { formatCurrency, formatDate } from '../lib/shopify'
import { cn } from '../utils/cn'
import {
  VEST_MEASUREMENT_RANGES,
  SHIRT_MEASUREMENT_RANGES,
  JACKET_MEASUREMENT_RANGES,
  TROUSER_MEASUREMENT_RANGES,
  SUIT_MEASUREMENT_RANGES,
} from '../constants/data'

const ORDERS_PER_PAGE = 15

const PAYMENT_BADGE = {
  PAID: 'paid',
  PENDING: 'pending',
  AUTHORIZED: 'pending',
  PARTIALLY_PAID: 'partial',
  PARTIALLY_REFUNDED: 'partial',
  REFUNDED: 'failed',
  VOIDED: 'failed',
}

function mapSupplierStatus(order) {
  const meta = Object.fromEntries(
    (order.metafields?.edges ?? []).map((e) => [e.node.key, e.node.value])
  )
  return meta.supplier_status || 'pending'
}

function mapFulfillmentStatus(order) {
  if (order.displayFinancialStatus === 'REFUNDED' || order.displayFinancialStatus === 'VOIDED')
    return 'failed'
  if (order.displayFulfillmentStatus === 'FULFILLED') return 'submitted'
  return 'pending'
}

function itemsLabel(order) {
  const edges = order.lineItems?.edges ?? []
  const hasMore = order.lineItems?.pageInfo?.hasNextPage
  return hasMore
    ? `${edges.length}+ items`
    : `${edges.length} ${edges.length === 1 ? 'item' : 'items'}`
}

// Key = product title. name = _profile_name attr or "Measurement N".
// All non-_ attrs → measurements. No deduplication (each order instance = own profile).
function buildMeasurementProfiles(orders) {
  const result = {}
  let counter = Math.floor(Date.now() / 1000)

  for (const order of orders) {
    const created = (order.createdAt ?? '').split('T')[0]

    for (const { node: item } of order.lineItems?.edges ?? []) {
      if (!item.product?.metafield?.value) continue
      const allAttrs = item.customAttributes ?? []
      const measureAttrs = allAttrs.filter((a) => !a.key.startsWith('_'))
      if (!measureAttrs.length) continue

      const productName = item.title
      if (!result[productName]) result[productName] = []
      if (result[productName].length >= 5) continue

      const profileName = allAttrs.find((a) => a.key === '_profile_name')?.value
      const idx = result[productName].length + 1
      const measurements = Object.fromEntries(
        measureAttrs.map(({ key, value }) => [
          key,
          value?.endsWith('"') ? value.slice(0, -1) : value,
        ])
      )

      result[productName].push({
        id: `prof_${counter++}`,
        name: profileName || `Measurement ${idx}`,
        created,
        measurements,
      })
    }
  }

  return result
}

// Case-insensitive, trimmed range lookup so Shopify key casing never breaks hints
function getRangeForKey(rangeMap, key) {
  if (!rangeMap) return null
  if (rangeMap[key]) return rangeMap[key]
  const normalised = key.toLowerCase().trim()
  for (const [k, v] of Object.entries(rangeMap)) {
    if (k.toLowerCase().trim() === normalised) return v
  }
  return null
}

export default function CustomerDetail() {
  const { customerId } = useParams()
  const shopifyGid = `gid://shopify/Customer/${customerId}`
  const { customer, orders, loading, error } = useCustomerDetail(shopifyGid)

  const [currentPage, setCurrentPage] = useState(1)
  const profiles = useMemo(() => buildMeasurementProfiles(orders), [orders])

  const [committedProfiles, setCommittedProfiles] = useState(null)
  // Per-profile edit state
  const [editingProfileId, setEditingProfileId] = useState(null)
  const [editingValues, setEditingValues] = useState({})
  const [touchedFields, setTouchedFields] = useState(new Set())
  const [savingProfileId, setSavingProfileId] = useState(null)
  const [profileErrors, setProfileErrors] = useState({})

  // Source of truth for display: user-saved edits take priority over order-derived data
  const activeProfiles = committedProfiles ?? profiles

  const handleProfileEditStart = (entry) => {
    setEditingProfileId(entry.id)
    setEditingValues({ ...entry.measurements })
    setTouchedFields(new Set())
    setProfileErrors((prev) => ({ ...prev, [entry.id]: null }))
  }

  const handleProfileCancel = () => {
    setEditingProfileId(null)
    setEditingValues({})
    setTouchedFields(new Set())
  }

  const handleProfileMeasurementChange = (key, val) => {
    setEditingValues((prev) => ({ ...prev, [key]: val }))
    setTouchedFields((prev) => new Set([...prev, key]))
  }

  const handleProfileSave = async (entry) => {
    setSavingProfileId(entry.id)
    setProfileErrors((prev) => ({ ...prev, [entry.id]: null }))

    // Build updated full profiles with only this profile's measurements changed
    const updatedProfiles = JSON.parse(JSON.stringify(activeProfiles))
    updatedProfiles[entry.productName] = updatedProfiles[entry.productName].map((p) =>
      p.id === entry.id ? { ...p, measurements: { ...editingValues } } : p
    )

    try {
      const res = await fetch(`/api/customers/${customerId}/sync-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedProfiles }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Server error ${res.status}`)
      }
      setCommittedProfiles(updatedProfiles)
      setEditingProfileId(null)
      setEditingValues({})
      setTouchedFields(new Set())
    } catch (err) {
      setProfileErrors((prev) => ({ ...prev, [entry.id]: err.message }))
    } finally {
      setSavingProfileId(null)
    }
  }

  const allMeasurements = useMemo(
    () =>
      Object.entries(activeProfiles).flatMap(([productName, list]) =>
        list.map((p) => ({ productName, ...p }))
      ),
    [activeProfiles]
  )

  // Auto-sync to Shopify whenever orders load and profiles exist
  useEffect(() => {
    if (!orders.length || !customerId) return
    const data = profiles
    if (Object.keys(data).length === 0) return
    fetch(`/api/customers/${customerId}/sync-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    }).catch(() => {})
  }, [orders, customerId])

  const totalPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE))
  const paginated = orders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE)

  const visiblePages = useMemo(() => {
    const range = 3
    const start = Math.max(1, currentPage - range)
    const end = Math.min(totalPages, currentPage + range)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [currentPage, totalPages])

  return (
    <DashboardLayout>
      {/* Back */}
      <div className="mb-[20px]">
        <Link
          to="/customers"
          className="inline-flex items-center gap-[6px] text-13 text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Customers
        </Link>
      </div>

      {loading && (
        <div className="card">
          <LoadingState message="Loading customer…" />
        </div>
      )}
      {error && (
        <div className="card">
          <ErrorState message={error} />
        </div>
      )}

      {!loading && !error && customer && (
        <div className="space-y-[20px]">
          {/* ── Customer header ── */}
          <div className="card p-[20px] md:p-[24px]">
            <div className="flex flex-wrap items-start gap-[20px]">
              {/* Avatar */}
              <div className="w-[60px] h-[60px] rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <span className="text-24 font-bold text-white">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-24 font-bold text-text-primary leading-tight">
                  {customer.name}
                </h1>
                <div className="flex flex-wrap gap-[16px] mt-[8px]">
                  {customer.email && (
                    <span className="flex items-center gap-[5px] text-13 text-text-muted">
                      <Mail size={13} />
                      {customer.email}
                    </span>
                  )}
                  {customer.phone && (
                    <span className="flex items-center gap-[5px] text-13 text-text-muted">
                      <Phone size={13} />
                      {customer.phone}
                    </span>
                  )}
                  {customer.address?.city && (
                    <span className="flex items-center gap-[5px] text-13 text-text-muted">
                      <MapPin size={13} />
                      {[customer.address.city, customer.address.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-[24px] mt-[20px] pt-[20px] border-t border-border">
              <div>
                <p className="text-11 text-text-muted font-semibold uppercase tracking-wider mb-[2px]">
                  Total Orders
                </p>
                <p className="text-20 font-bold text-text-primary">{orders.length}</p>
              </div>
              <div>
                <p className="text-11 text-text-muted font-semibold uppercase tracking-wider mb-[2px]">
                  Total Spent
                </p>
                <p className="text-20 font-bold text-text-primary">{customer.totalSpent}</p>
              </div>
              <div>
                <p className="text-11 text-text-muted font-semibold uppercase tracking-wider mb-[2px]">
                  Customer Since
                </p>
                <p className="text-14 font-medium text-text-primary">{customer.registrationDate}</p>
              </div>
            </div>
          </div>

          {/* ── Orders ── */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-[8px] px-[20px] py-[14px] border-b border-border bg-gray-50">
              <ShoppingBag size={14} className="text-text-muted" />
              <h3 className="text-14 font-semibold text-text-primary">Orders</h3>
              <span className="ml-auto text-12 text-text-muted">{orders.length} total</span>
            </div>

            {orders.length === 0 ? (
              <div className="py-[48px] text-center text-text-muted text-14">No orders yet.</div>
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((order) => {
                        const numericId = order.id.split('/').pop()
                        return (
                          <tr key={order.id}>
                            <td>
                              <Link
                                to={`/orders/${numericId}`}
                                state={{ fromCustomer: customerId }}
                                className="font-bold text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                              >
                                {order.name}
                              </Link>
                            </td>
                            <td className="text-text-secondary whitespace-nowrap">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="text-text-secondary">{itemsLabel(order)}</td>
                            <td className="font-semibold text-text-primary">
                              {formatCurrency(order.totalPriceSet)}
                            </td>
                            <td>
                              <Badge
                                status={PAYMENT_BADGE[order.displayFinancialStatus] ?? 'pending'}
                              />
                            </td>
                            <td>
                              <Badge status={mapFulfillmentStatus(order)} />
                            </td>
                            <td>
                              <Badge status={mapSupplierStatus(order)} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {orders.length > ORDERS_PER_PAGE && (
                  <div className="flex items-center justify-between px-[20px] py-[14px] border-t border-border flex-wrap gap-[10px]">
                    <p className="text-13 text-text-muted">
                      Showing{' '}
                      <span className="font-semibold text-text-primary">
                        {(currentPage - 1) * ORDERS_PER_PAGE + 1}
                      </span>{' '}
                      –{' '}
                      <span className="font-semibold text-text-primary">
                        {Math.min(currentPage * ORDERS_PER_PAGE, orders.length)}
                      </span>{' '}
                      of <span className="font-semibold text-text-primary">{orders.length}</span>
                    </p>

                    <div className="flex items-center gap-[5px]">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-[7px] rounded-lg border border-border text-text-secondary hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={15} />
                      </button>

                      {visiblePages[0] > 1 && (
                        <>
                          <button
                            onClick={() => setCurrentPage(1)}
                            className="w-[34px] h-[34px] rounded-lg text-13 font-medium border border-border text-text-secondary hover:bg-gray-50 transition-colors"
                          >
                            1
                          </button>
                          {visiblePages[0] > 2 && (
                            <span className="text-text-muted px-[4px]">…</span>
                          )}
                        </>
                      )}

                      {visiblePages.map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            'w-[34px] h-[34px] rounded-lg text-13 font-medium transition-colors',
                            currentPage === page
                              ? 'bg-brand-600 text-white'
                              : 'border border-border text-text-secondary hover:bg-gray-50'
                          )}
                        >
                          {page}
                        </button>
                      ))}

                      {visiblePages[visiblePages.length - 1] < totalPages && (
                        <>
                          {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                            <span className="text-text-muted px-[4px]">…</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-[34px] h-[34px] rounded-lg text-13 font-medium border border-border text-text-secondary hover:bg-gray-50 transition-colors"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-[7px] rounded-lg border border-border text-text-secondary hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Measurements ── */}
          {allMeasurements.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-[8px] px-[20px] py-[14px] border-b border-border bg-gray-50">
                <Ruler size={14} className="text-text-muted" />
                <h3 className="text-14 font-semibold text-text-primary">Measurements</h3>
                <span className="text-12 text-text-muted">
                  {allMeasurements.length} profile{allMeasurements.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-border">
                {allMeasurements.map((entry) => {
                  const isEditing = editingProfileId === entry.id
                  const isSaving = savingProfileId === entry.id
                  const profileError = profileErrors[entry.id]
                  const productLower = entry.productName.toLowerCase()
                  // Check suit/tuxedo first — they combine all three garments
                  const isSuit    = productLower.includes('tuxedo') || productLower.includes('suit')
                  const isJacket  = productLower.includes('jacket') || productLower.includes('overcoat')
                  const isTrouser = productLower.includes('trouser')
                  const isVest    = productLower.includes('vest')
                  const isShirt   = productLower.includes('shirt')
                  const RANGES = isSuit
                    ? SUIT_MEASUREMENT_RANGES
                    : isJacket
                      ? JACKET_MEASUREMENT_RANGES
                      : isTrouser
                        ? TROUSER_MEASUREMENT_RANGES
                        : isVest
                          ? VEST_MEASUREMENT_RANGES
                          : isShirt
                            ? SHIRT_MEASUREMENT_RANGES
                            : null
                  // Find size type value (case-insensitive key match)
                  const sizeTypeKey = Object.keys(entry.measurements).find(
                    (k) => k.toLowerCase() === 'size type'
                  )
                  const isStandard =
                    sizeTypeKey &&
                    entry.measurements[sizeTypeKey]?.toLowerCase() === 'standard'

                  return (
                    <div key={entry.id} className="p-[16px] md:p-[20px]">
                      {/* Profile header row */}
                      <div className="flex flex-wrap items-center gap-[8px] mb-[12px]">
                        <span className="text-12 font-semibold text-brand-600 bg-brand-50 px-[10px] py-[3px] rounded-full">
                          {entry.productName}
                        </span>
                        <span className="text-14 font-semibold text-text-primary">{entry.name}</span>
                        <span className="text-12 text-text-muted">{entry.created}</span>
                        <div className="ml-auto flex items-center gap-[6px]">
                          {profileError && (
                            <span className="text-12 text-red-500">{profileError}</span>
                          )}
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleProfileSave(entry)}
                                disabled={isSaving}
                                className="btn-primary gap-[5px] text-13 py-[5px] px-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Save size={12} />
                                {isSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={handleProfileCancel}
                                disabled={isSaving}
                                className="btn-secondary gap-[5px] text-13 py-[5px] px-[10px] disabled:opacity-50"
                              >
                                <X size={12} />
                                Cancel
                              </button>
                            </>
                          ) : !isStandard && (
                            <button
                              onClick={() => handleProfileEditStart(entry)}
                              disabled={!!editingProfileId}
                              className="btn-secondary gap-[5px] text-13 py-[5px] px-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Pencil size={12} />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Measurements grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-[8px]">
                        {Object.entries(isEditing ? editingValues : entry.measurements).map(([key, val]) => {
                          const isSizeType = key.toLowerCase() === 'size type'
                          const range = getRangeForKey(RANGES, key)
                          const isTouched = touchedFields.has(key)
                          const numVal = parseFloat(val)
                          const hasRange = !!range
                          // Only validate if user has actually typed in this field
                          const isValid = isTouched && hasRange && !isNaN(numVal) && numVal >= range.min && numVal <= range.max
                          const isInvalid = isTouched && hasRange && !isNaN(numVal) && (numVal < range.min || numVal > range.max)

                          return (
                            <div
                              key={key}
                              className="bg-gray-50 rounded-lg px-[10px] py-[8px] border border-border-light"
                            >
                              <p className="text-11 text-text-muted font-medium mb-[2px] truncate">
                                {key}
                              </p>
                              {isEditing && !isSizeType ? (
                                <>
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleProfileMeasurementChange(key, e.target.value)}
                                    className={cn(
                                      'w-full text-14 font-bold text-text-primary bg-white rounded px-[6px] py-[2px] focus:outline-none border',
                                      isValid
                                        ? 'border-green-500 focus:ring-1 focus:ring-green-400'
                                        : isInvalid
                                          ? 'border-red-400 focus:ring-1 focus:ring-red-400'
                                          : 'border-gray-300 focus:ring-1 focus:ring-brand-500'
                                    )}
                                  />
                                  {range && (
                                    <p className={cn(
                                      'mt-[2px] leading-tight',
                                      'text-[10px]',
                                      isValid ? 'text-green-600' : isInvalid ? 'text-red-500' : 'text-text-muted'
                                    )}>
                                      {range.label}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="text-14 font-bold text-text-primary">{val}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
