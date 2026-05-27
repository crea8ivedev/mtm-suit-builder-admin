// ─── Vest Builder measurement ranges ──────────────────────────────────────
const VEST_RANGES_BASE = {
  'Neck':             { min: 11.8, max: 27.6, label: '11.8–27.6' },
  'Chest':            { min: 26,   max: 88.2, label: '26–88.2'   },
  'Stomach':          { min: 21.7, max: 86.2, label: '21.7–86.2' },
  'Nape to Waist':    { min: 10.6, max: 24.8, label: '10.6–24.8' },
  'Front Waist Len':  { min: 11.8, max: 29.5, label: '11.8–29.5' },
  'Front Waist Ht':   { min: 0,    max: 11.8, label: '0–11.8'   },
  'Back Waist Ht':    { min: 0,    max: 6.7,  label: '0–6.7'    },
  'Shoulder':         { min: 12.2, max: 28.3, label: '12.2–28.3' },
  'Back Length':      { min: 15,   max: 30.7, label: '15–30.7'  },
  'Front Shoulder':   { min: 11.4, max: 26.8, label: '11.4–26.8' },
  '1st Btn Position': { min: 7.5,  max: 23.6, label: '7.5–23.6' },
  'Highest Point':    { min: 22.8, max: 72.8, label: '22.8–72.8' },
}

// ─── Shirt Builder measurement ranges ─────────────────────────────────────
const SHIRT_RANGES_BASE = {
  'Neck':              { min: 11.8, max: 27.6, label: '11.8–27.6' },
  'Chest':             { min: 26,   max: 88.2, label: '26–88.2'   },
  'Stomach':           { min: 21.7, max: 86.2, label: '21.7–86.2' },
  'Seat (Hip)':        { min: 26.8, max: 86.6, label: '26.8–86.6' },
  'Shoulder':          { min: 12.2, max: 28.3, label: '12.2–28.3' },
  'Back Length':       { min: 14,   max: 41.3, label: '14–41.3'  },
  'Sleeve (L)':        { min: 9.8,  max: 35.4, label: '9.8–35.4' },
  'Sleeve (R)':        { min: 9.8,  max: 35.4, label: '9.8–35.4' },
  'Bicep':             { min: 7.5,  max: 29.1, label: '7.5–29.1' },
  'Nape to Waist':     { min: 10.6, max: 24.8, label: '10.6–24.8' },
  'Front Waist Len':   { min: 11.8, max: 29.5, label: '11.8–29.5' },
  'Front Shoulder':    { min: 11.4, max: 26.8, label: '11.4–26.8' },
  '1st Btn Position':  { min: 7.5,  max: 23.6, label: '7.5–23.6' },
  'Highest Point':     { min: 22.8, max: 72.8, label: '22.8–72.8' },
  'Back Width':        { min: 13.4, max: 28.3, label: '13.4–28.3' },
  'Front Chest Width': { min: 11.8, max: 28.3, label: '11.8–28.3' },
}

// ─── Jacket / Overcoat Builder measurement ranges ─────────────────────────
const JACKET_RANGES_BASE = {
  'Neck':              { min: 11.8, max: 27.6, label: '11.8–27.6' },
  'Chest':             { min: 26,   max: 88.2, label: '26–88.2'   },
  'Stomach':           { min: 21.7, max: 86.2, label: '21.7–86.2' },
  'Seat (Hip)':        { min: 26.8, max: 86.6, label: '26.8–86.6' },
  'Shoulder':          { min: 12.2, max: 28.3, label: '12.2–28.3' },
  'Back Length':       { min: 14,   max: 41.3, label: '14–41.3'   },
  'Sleeve (L)':        { min: 9.8,  max: 35.4, label: '9.8–35.4'  },
  'Sleeve (R)':        { min: 9.8,  max: 35.4, label: '9.8–35.4'  },
  'Bicep':             { min: 7.5,  max: 29.1, label: '7.5–29.1'  },
  'Nape to Waist':     { min: 10.6, max: 24.8, label: '10.6–24.8' },
  'Front Waist Len':   { min: 11.8, max: 29.5, label: '11.8–29.5' },
  'Front Shoulder':    { min: 11.4, max: 26.8, label: '11.4–26.8' },
  '1st Btn Position':  { min: 7.5,  max: 23.6, label: '7.5–23.6'  },
  'Highest Point':     { min: 22.8, max: 72.8, label: '22.8–72.8' },
  'Back Width':        { min: 13.4, max: 28.3, label: '13.4–28.3' },
  'Front Chest Width': { min: 11.8, max: 28.3, label: '11.8–28.3' },
}

// ─── Trouser Builder measurement ranges ───────────────────────────────────
const TROUSER_RANGES_BASE = {
  'Waist':        { min: 22.8, max: 79.5, label: '22.8–79.5' },
  'Seat':         { min: 26.8, max: 86.6, label: '26.8–86.6' },
  'Thigh':        { min: 15.4, max: 44.5, label: '15.4–44.5' },
  'Rise':         { min: 7,    max: 20,   label: '7–20'      },
  'Outseam (L)':  { min: 21.3, max: 58.3, label: '21.3–58.3' },
  'Outseam (R)':  { min: 21.3, max: 58.3, label: '21.3–58.3' },
  'Front Waist Ht': { min: 0.4, max: 11.8, label: '0.4–11.8' },
  'Back Waist Ht':  { min: 0.4, max: 8.3,  label: '0.4–8.3'  },
  'Knee':         { min: 11.8, max: 40.6, label: '11.8–40.6' },
  'Bottom':       { min: 11,   max: 31.5, label: '11–31.5'   },
  'Calf':         { min: 9.8,  max: 27.6, label: '9.8–27.6'  },
}

// Include prefixed variants (e.g. "Vest Neck", "Shirt Neck") so raw Shopify
// attribute keys match regardless of how they are stored.
const buildRangeMap = (base, prefix) =>
  Object.fromEntries([
    ...Object.entries(base),
    ...Object.entries(base).map(([k, v]) => [`${prefix} ${k}`, v]),
  ])

export const VEST_MEASUREMENT_RANGES    = buildRangeMap(VEST_RANGES_BASE,    'Vest')
export const SHIRT_MEASUREMENT_RANGES   = buildRangeMap(SHIRT_RANGES_BASE,   'Shirt')
export const JACKET_MEASUREMENT_RANGES  = buildRangeMap(JACKET_RANGES_BASE,  'Jacket')
export const TROUSER_MEASUREMENT_RANGES = buildRangeMap(TROUSER_RANGES_BASE, 'Trouser')

// Tuxedo / Suit Builder combines Jacket + Trouser + Vest in one product.
// Merge all three maps so prefixed keys (e.g. "Jacket Neck", "Trouser Waist",
// "Vest Neck") all resolve to the correct range.
export const SUIT_MEASUREMENT_RANGES = {
  ...buildRangeMap(JACKET_RANGES_BASE,  'Jacket'),
  ...buildRangeMap(TROUSER_RANGES_BASE, 'Trouser'),
  ...buildRangeMap(VEST_RANGES_BASE,    'Vest'),
}

// ─── Dashboard stat cards ──────────────────────────────────────────────────
// `value` is overridden dynamically in Dashboard.jsx using real Shopify counts
export const STAT_CARDS = [
  {
    id: 'total',
    label: 'Total Orders',
    value: '—',
    change: null,
    changeType: null,
    icon: 'ShoppingBag',
    bgColor: '#eff6ff',
    iconColor: '#3b82f6',
  },
  {
    id: 'pending',
    label: 'Pending Orders',
    value: '—',
    change: null,
    changeType: null,
    icon: 'Clock',
    bgColor: '#fffbeb',
    iconColor: '#d97706',
  },
  {
    id: 'submitted',
    label: 'Submitted Orders',
    value: '—',
    change: null,
    changeType: null,
    icon: 'CheckCircle',
    bgColor: '#ecfdf5',
    iconColor: '#059669',
  },
  {
    id: 'failed',
    label: 'Failed Orders',
    value: '—',
    change: null,
    changeType: null,
    icon: 'XCircle',
    bgColor: '#fef2f2',
    iconColor: '#dc2626',
  },
]
