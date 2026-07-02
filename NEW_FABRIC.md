# Fabric Feature — Overview (Updated)

## What changed

The fabric architecture has migrated from **fabric-as-variant** to
**fabric-as-product**. Previously, fabrics were variants on a single
shared Shopify product ("The Tropical Custom Suit"). Now:

- Each fabric is its own **standalone Shopify product**
- Style (Suit 2 piece, Jacket only, Trouser only, etc.) is the
  **variant axis** inside each fabric product
- Fabric metadata (code, house, color, material, weight) lives in a
  **`gc_fabrics` Shopify metaobject**, linked to the fabric product
  via the `gc_builder.fabric` product metafield
- Category/browsing is handled by **native Shopify collections**
  (one per fabric house), not the old `gc_builder.sections` metafield

---

## What the `/fabric` admin page now manages

1. **Fabric library** — create, edit, delete, and toggle visibility
   of fabric entries. Each entry creates a real Shopify product AND
   a `gc_fabrics` metaobject entry, linked together.
2. **Fabric visibility** — show/hide a fabric on the storefront by
   setting the Shopify product to Active or Draft (replaces the old
   metaobject boolean toggle).
3. **Style variants per fabric** — each fabric product has variants
   for the styles it is available in (Suit 2pc, Suit 3pc, Jacket
   only, Trouser only, Vest only, Shirt). Staff sets price per style
   variant at fabric creation time and can edit later.
4. **Collection assignment** — when a fabric is created, it is
   auto-assigned to the correct Shopify collection(s) based on
   which style variants are selected (e.g. a fabric with Suit 2pc
   and Jacket only variants goes into both the Suits and Jackets
   collections).

---

## Page layout

```
┌─────────────────────────────────────────────────────┐
│  Fabric Library                      [+ Add Fabric]  │
│                                                      │
│  [swatch] Cerruti 1881 — Grey    Active  [✎] [🗑]   │
│           DAP277A · 100% Wool                        │
│           Suit 2pc · Jacket only                     │
│                                                      │
│  [swatch] Dormeuil — Blue Plaid  Active  [✎] [🗑]   │
│           DAQ1865 · 55% Wool 45% Silk                │
│           Suit 2pc · Suit 3pc                        │
│                                                      │
│  [swatch] Zegna — Grey Plaid     Draft   [✎] [🗑]   │
│           DAA544A · 95W5S                            │
│           Suit 2pc · Trouser only                    │
└─────────────────────────────────────────────────────┘
```

Each fabric card shows:
- Swatch image
- Fabric house + color name
- Fabric code + material
- Which style variants it is available in
- Active (visible on storefront) or Draft (hidden)
- Edit and Delete actions

---

## Core flows

### Add a fabric
"Add Fabric" → fill in:
- Fabric name (e.g. "Grey Flannel")
- Fabric house / vendor (e.g. "Cerruti 1881")
- Fabric code (e.g. "DAP277A") — or type the code and hit
  **"Fetch"** to auto-fill color, material, weight, and swatch
  image from KuteTailor API
- Color, Material, Weight (auto-filled by Fetch or entered manually)
- Which styles this fabric is available in (checkboxes:
  Suit 2pc / Suit 3pc / Jacket only / Trouser only / Vest only / Shirt)
- Price per style (one price field per selected style)
- Swatch image (auto-attached from KuteTailor Fetch, or upload
  manually)

On save this flow:
1. Creates a `gc_fabrics` metaobject entry with all fabric details
2. Creates a Shopify product with the fabric name as title, vendor
   as fabric house, and one variant per selected style with the
   correct price
3. Attaches the swatch image to the Shopify product
4. Links the product to the metaobject via `gc_builder.fabric`
   product metafield
5. Assigns the product to the correct Shopify collection(s) based
   on selected styles

### Edit a fabric
Pencil icon → opens edit form pre-filled with all current values.
Saves changes to both the `gc_fabrics` metaobject entry AND the
Shopify product (title, vendor, images, variant prices).

### Toggle visibility
Active/Draft badge is clickable. Toggling sets the Shopify product
status to Active (visible on storefront) or Draft (hidden from
customers). Staff can always see all fabrics in admin regardless
of status.

### Delete a fabric
Trash icon → confirmation dialog → on confirm:
1. Deletes the Shopify product (and all its variants)
2. Deletes the `gc_fabrics` metaobject entry
Blocked with a warning if there are existing Shopify orders
referencing this fabric product — cannot delete until resolved.

### Fetch from KuteTailor
Entering a fabric code and clicking "Fetch" calls:
`GET /fabric/fabric/queryFabric?fabricCode={code}`
Auto-fills: color name, material composition, swatch image URL.
The fetched image is downloaded and uploaded to Shopify Files,
then attached to the fabric product and metaobject entry.

---

## Data model

### gc_fabrics metaobject (one entry per fabric)

| Field | Type | Example |
|-------|------|---------|
| fabric_code | single_line_text | "DAP277A" |
| fabric_house | single_line_text | "Cerruti 1881" |
| color | single_line_text | "Grey" |
| material | single_line_text | "100% Wool" |
| weight | single_line_text | "270g/m" |
| image | file_reference | [swatch photo] |

### Shopify product (one per fabric)

| Field | Value |
|-------|-------|
| title | "Cerruti 1881 — Grey Flannel" |
| vendor | "Cerruti 1881" |
| product_type | "Suits & Tuxedo Fabric" or "Shirt Fabric" |
| status | Active or Draft |
| metafield gc_builder.fabric | → gc_fabrics metaobject entry |

### Variants inside each fabric product

| Variant title | Price |
|---------------|-------|
| Suit 2 piece | $X |
| Suit 3 piece | $X |
| Jacket only | $X |
| Trouser only | $X |
| Vest only | $X |
| Shirt | $X |

Only the styles selected at creation time get variants. A fabric
available only as a shirt fabric will have one variant: "Shirt".

### Shopify collections (auto-assigned on fabric creation)

| Collection | Rule |
|------------|------|
| Suits | fabric has "Suit 2 piece" or "Suit 3 piece" variant |
| Jackets | fabric has "Jacket only" variant |
| Trousers | fabric has "Trouser only" variant |
| Vests | fabric has "Vest only" variant |
| Shirts | fabric has "Shirt" variant |
| [Fabric house name] | vendor = fabric house name |
| All Fabrics | all fabric products |

---

## Where things live

| Concern | File |
|---------|------|
| Page shell / data loading | `src/pages/Fabric.jsx` |
| Fabric library (add/edit/delete/fetch) | `src/components/fabric/FabricLibrarySection.jsx` |
| Shopify Admin API calls | `src/lib/shopify.js` |
| KuteTailor API call (fetch by code) | `src/lib/kutetailor.js` |
| Metaobject CRUD | `src/lib/shopify.js` → `createMetaobject`, `updateMetaobject`, `deleteMetaobject` |
| Product CRUD | `src/lib/shopify.js` → `createProduct`, `updateProduct`, `deleteProduct` |
| Collection assignment | `src/lib/shopify.js` → `addProductToCollection` |

---

## Key API calls used

### Create fabric (on Add Fabric save)
```
1. POST /metaobjects  → create gc_fabrics entry
2. POST /products     → create fabric product with variants
3. POST /products/{id}/metafields  → link gc_builder.fabric to metaobject
4. POST /collections/{id}/products → assign to correct collections
5. POST /files        → upload swatch image (if fetched from KuteTailor)
```

### Edit fabric
```
1. PUT /metaobjects/{id}  → update gc_fabrics entry fields
2. PUT /products/{id}     → update product title, vendor, images
3. PUT /variants/{id}     → update variant prices
```

### Toggle visibility
```
PUT /products/{id}  → { status: "active" | "draft" }
```

### Delete fabric
```
1. DELETE /metaobjects/{id}
2. DELETE /products/{id}
```

### Fetch from KuteTailor
```
GET https://platform.kutetailor.com/api/fabric/fabric/queryFabric
    ?fabricCode={code}
Authorization: bearer {token}
Returns: fabricCode, imageUrl, material, colorName, stock
```

---

## What is removed vs old approach

| Old | New |
|-----|-----|
| Fabric = variant on shared suit product | Fabric = standalone Shopify product |
| Style = gc_builder.sections metafield tag | Style = variant inside fabric product |
| Visibility = metaobject boolean field | Visibility = Shopify product Active/Draft |
| Category = GC Builder text metafield | Category = native Shopify collections |
| Fabric data = variant option value | Fabric data = gc_fabrics metaobject linked via gc_builder.fabric product metafield |
| FabricModal + StyleCategorySection components | Single FabricLibrarySection handles all |

---

## Known caveats

- The KuteTailor Fetch only works when the fabric code exists in
  KuteTailor's catalog for the GCCS1 account. Codes for client's
  own fabrics (not from KuteTailor) must be entered manually —
  image and details will not auto-fill.
- Deleting a fabric product in Shopify admin directly (bypassing
  the admin panel delete flow) will leave an orphaned gc_fabrics
  metaobject entry. Always delete via the admin panel.
- Shopify's 250-media-per-product cap applies. Keep fabric images
  to 1–3 per product (swatch + lifestyle shots). Do not upload
  full lookbook photo sets per fabric.