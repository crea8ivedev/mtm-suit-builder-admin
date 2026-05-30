const ENDPOINT = "/api/shopify/graphql.json";

// ─── GraphQL query ─────────────────────────────────────────────────────────
// Fetches one page of orders with cursor-based pagination.
// lineItems(first: 10) keeps per-request cost well under Shopify's 1 000-point limit.
// (50 orders × 10 lineItems × ~2 fields ≈ 1 000 cost units total.)
const GET_ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String) {
    orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          customer {
            id
            firstName
            lastName
            email
            phone
          }
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                customAttributes {
                  key
                  value
                }
                product {
                  metafield(namespace: "custom", key: "gc_builder") {
                    value
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
            }
          }
          metafields(first: 3, namespace: "suit_admin") {
            edges {
              node {
                key
                value
              }
            }
          }
        }
      }
    }
  }
`;

// ─── Low-level GraphQL executor ────────────────────────────────────────────
async function shopifyGraphQL(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message || "Unknown GraphQL error");
  }

  return json.data;
}

// ─── Single-order detail query ─────────────────────────────────────────────
const GET_ORDER_QUERY = `
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      note
      tags
      customer {
        id
        firstName
        lastName
        email
        phone
      }
      shippingAddress {
        firstName
        lastName
        address1
        address2
        city
        province
        country
        zip
        phone
      }
      billingAddress {
        firstName
        lastName
        address1
        address2
        city
        province
        country
        zip
      }
      subtotalPriceSet {
        shopMoney { amount currencyCode }
      }
      totalShippingPriceSet {
        shopMoney { amount currencyCode }
      }
      totalTaxSet {
        shopMoney { amount currencyCode }
      }
      totalPriceSet {
        shopMoney { amount currencyCode }
      }
      lineItems(first: 50) {
        edges {
          node {
            id
            title
            quantity
            product {
              id
            }
            variant {
              title
              sku
            }
            originalUnitPriceSet {
              shopMoney { amount currencyCode }
            }
            discountedTotalSet {
              shopMoney { amount currencyCode }
            }
            customAttributes {
              key
              value
            }
          }
        }
      }
      fulfillments(first: 5) {
        status
        trackingInfo {
          number
          url
          company
        }
        updatedAt
      }
      metafields(first: 10, namespace: "suit_admin") {
        edges {
          node {
            key
            value
          }
        }
      }
    }
  }
`;

// ─── Products query ────────────────────────────────────────────────────────
const GET_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
          metafield(namespace: "custom", key: "gc_builder") {
            value
          }
        }
      }
    }
  }
`;

let _gcProductsCache = null;

export async function fetchGcBuilderProducts() {
  if (_gcProductsCache) return _gcProductsCache;
  const all = [];
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const data = await shopifyGraphQL(GET_PRODUCTS_QUERY, {
      first: 50,
      after: cursor,
    });
    const { edges, pageInfo } = data.products;
    all.push(
      ...edges.map((e) => e.node).filter((p) => p.metafield?.value?.trim()),
    );
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  _gcProductsCache = all;
  return all;
}

// ─── Module-level cache ────────────────────────────────────────────────────
let _cachedOrders = null;
let _fetchPromise = null;
const _orderDetailCache = new Map();

export function clearOrdersCache() {
  _cachedOrders = null;
  _fetchPromise = null;
}

export function clearOrderDetailCache(shopifyGid) {
  _orderDetailCache.delete(shopifyGid);
}

// ─── Fetch single order by Shopify GID ─────────────────────────────────────
export async function fetchOrderById(shopifyGid) {
  if (_orderDetailCache.has(shopifyGid)) {
    return _orderDetailCache.get(shopifyGid);
  }
  const data = await shopifyGraphQL(GET_ORDER_QUERY, { id: shopifyGid });
  _orderDetailCache.set(shopifyGid, data.order);
  return data.order;
}

// ─── Fetch ALL orders with cursor pagination ───────────────────────────────
// Loops through pages until pageInfo.hasNextPage is false.
// onProgress(count) is called after each page to allow live progress display.
// Returns true if at least one line item belongs to a gc_builder product
function hasGcBuilderItem(order) {
  return (order.lineItems?.edges ?? []).some(({ node }) =>
    node.product?.metafield?.value?.trim(),
  );
}

async function _doFetch(onProgress) {
  const all = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const data = await shopifyGraphQL(GET_ORDERS_QUERY, {
      first: 50,
      after: cursor,
    });

    const { edges, pageInfo } = data.orders;
    // Only keep orders that have at least one gc_builder product line item
    const filtered = edges.map((e) => e.node).filter(hasGcBuilderItem);
    all.push(...filtered);
    if (onProgress) onProgress(all.length);

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return all;
}

export function fetchAllOrders(onProgress) {
  if (_cachedOrders) {
    if (onProgress) onProgress(_cachedOrders.length);
    return Promise.resolve(_cachedOrders);
  }

  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = _doFetch(onProgress)
    .then((orders) => {
      _cachedOrders = orders;
      _fetchPromise = null;
      return orders;
    })
    .catch((err) => {
      _fetchPromise = null;
      throw err;
    });

  return _fetchPromise;
}

// ─── Customer queries ──────────────────────────────────────────────────────
const GET_CUSTOMERS_QUERY = `
  query GetCustomers($first: Int!, $after: String) {
    customers(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          firstName
          lastName
          email
          phone
          createdAt
          numberOfOrders
          amountSpent { amount currencyCode }
        }
      }
    }
  }
`;

const GET_CUSTOMER_ORDERS_QUERY = `
  query GetCustomerOrders($id: ID!, $first: Int!, $after: String) {
    customer(id: $id) {
      id
      firstName
      lastName
      email
      phone
      createdAt
      numberOfOrders
      amountSpent { amount currencyCode }
      defaultAddress { address1 city province country zip }
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 20) {
              edges {
                node {
                  title
                  product {
                    id
                    metafield(namespace: "custom", key: "gc_builder") { value }
                  }
                  customAttributes { key value }
                }
              }
              pageInfo { hasNextPage }
            }
            metafields(first: 2, namespace: "suit_admin") {
              edges { node { key value } }
            }
          }
        }
      }
    }
  }
`;

let _cachedCustomers = null;
let _customerFetchPromise = null;
const _customerDetailCache = new Map();

export function clearCustomersCache() {
  _cachedCustomers = null;
  _customerFetchPromise = null;
}

export function clearCustomerDetailCache(shopifyGid) {
  _customerDetailCache.delete(shopifyGid);
}

async function _doFetchCustomers(onProgress) {
  // Always fetch fresh orders so customer.id is guaranteed in every node
  clearOrdersCache();
  const gcOrders = await fetchAllOrders();

  // Build per-customer gc_builder order count and total spent
  const gcOrderCountMap = new Map();
  const gcTotalSpentMap = new Map(); // customerId -> { amount, currencyCode }
  for (const order of gcOrders) {
    const cid = order.customer?.id;
    if (!cid) continue;
    gcOrderCountMap.set(cid, (gcOrderCountMap.get(cid) ?? 0) + 1);
    const shopMoney = order.totalPriceSet?.shopMoney;
    if (shopMoney) {
      const prev = gcTotalSpentMap.get(cid);
      const sum =
        parseFloat(prev?.amount ?? 0) + parseFloat(shopMoney.amount ?? 0);
      gcTotalSpentMap.set(cid, {
        amount: sum.toFixed(2),
        currencyCode: shopMoney.currencyCode,
      });
    }
  }

  const all = [];
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const data = await shopifyGraphQL(GET_CUSTOMERS_QUERY, {
      first: 50,
      after: cursor,
    });
    const { edges, pageInfo } = data.customers;
    // Only keep customers who appear in at least one gc_builder order
    // Attach gcOrderCount so the UI shows the correct filtered count
    const filtered = edges
      .map((e) => e.node)
      .filter((c) => gcOrderCountMap.has(c.id))
      .map((c) => ({
        ...c,
        gcOrderCount: gcOrderCountMap.get(c.id),
        gcTotalSpent: gcTotalSpentMap.get(c.id),
      }));
    all.push(...filtered);
    if (onProgress) onProgress(all.length);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  return all;
}

export function fetchAllCustomers(onProgress) {
  if (_cachedCustomers) {
    if (onProgress) onProgress(_cachedCustomers.length);
    return Promise.resolve(_cachedCustomers);
  }
  if (_customerFetchPromise) return _customerFetchPromise;
  _customerFetchPromise = _doFetchCustomers(onProgress)
    .then((c) => {
      _cachedCustomers = c;
      _customerFetchPromise = null;
      return c;
    })
    .catch((err) => {
      _customerFetchPromise = null;
      throw err;
    });
  return _customerFetchPromise;
}

export async function fetchCustomerWithOrders(shopifyGid) {
  if (_customerDetailCache.has(shopifyGid))
    return _customerDetailCache.get(shopifyGid);

  const allOrders = [];
  let hasNextPage = true;
  let cursor = null;
  let customerInfo = null;

  while (hasNextPage) {
    const data = await shopifyGraphQL(GET_CUSTOMER_ORDERS_QUERY, {
      id: shopifyGid,
      first: 50,
      after: cursor,
    });
    if (!customerInfo) {
      const { orders: _omit, ...info } = data.customer;
      customerInfo = info;
    }
    const { edges, pageInfo } = data.customer.orders;
    // Only keep orders that have at least one gc_builder product line item
    const gcOrders = edges.map((e) => e.node).filter(hasGcBuilderItem);
    allOrders.push(...gcOrders);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  const result = { ...customerInfo, allOrders };
  _customerDetailCache.set(shopifyGid, result);
  return result;
}

export function formatMoney(amountSpent) {
  if (!amountSpent) return "—";
  const { amount, currencyCode } = amountSpent;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(parseFloat(amount));
  } catch {
    return `${currencyCode} ${parseFloat(amount).toFixed(2)}`;
  }
}

export function transformCustomer(node) {
  const firstName = node.firstName || "";
  const lastName = node.lastName || "";
  return {
    id: node.id,
    numericId: node.id.split("/").pop(),
    name: `${firstName} ${lastName}`.trim() || "Guest",
    firstName,
    lastName,
    email: node.email || "",
    phone: node.phone || "",
    createdAt: node.createdAt,
    registrationDate: formatDate(node.createdAt),
    numberOfOrders: node.gcOrderCount ?? node.numberOfOrders ?? 0,
    totalSpent: formatMoney(node.gcTotalSpent ?? node.amountSpent),
    address: node.defaultAddress || null,
  };
}

// ─── Status mapping ────────────────────────────────────────────────────────
const PAYMENT_STATUS_MAP = {
  PAID: "paid",
  UNPAID: "unpaid",
  PENDING: "unpaid",
  AUTHORIZED: "unpaid",
  PARTIALLY_PAID: "partial",
  PARTIALLY_REFUNDED: "partial",
  REFUNDED: "failed",
  VOIDED: "failed",
};

const FULFILLMENT_STATUS_MAP = {
  FULFILLED: "fulfilled",
  UNFULFILLED: "unfulfilled",
  PARTIALLY_FULFILLED: "partial",
  IN_PROGRESS: "processing",
  ON_HOLD: "pending",
  OPEN: "unfulfilled",
  SCHEDULED: "pending",
};

// Map Shopify statuses → custom admin status column:
//   submitted = fulfilled (sent to supplier / delivered)
//   failed    = refunded or voided
//   pending   = everything else (awaiting processing)
function mapCustomStatus(node) {
  if (
    node.displayFinancialStatus === "REFUNDED" ||
    node.displayFinancialStatus === "VOIDED"
  ) {
    return "failed";
  }
  if (node.displayFulfillmentStatus === "FULFILLED") return "submitted";
  return "pending";
}

export function formatCurrency(totalPriceSet) {
  const { amount, currencyCode } = totalPriceSet.shopMoney;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(parseFloat(amount));
  } catch {
    return `${currencyCode} ${parseFloat(amount).toFixed(2)}`;
  }
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Transform raw Shopify order node → UI-ready shape ────────────────────
export function transformOrder(node) {
  const firstName = node.customer?.firstName || "";
  const lastName = node.customer?.lastName || "";
  const customerName = `${firstName} ${lastName}`.trim() || "Guest";

  const lineItemEdges = node.lineItems?.edges ?? [];
  const lineItemCount = lineItemEdges.length;
  const hasMoreItems = node.lineItems?.pageInfo?.hasNextPage ?? false;
  const itemsDisplay = hasMoreItems
    ? `${lineItemCount}+ items`
    : `${lineItemCount} ${lineItemCount === 1 ? "item" : "items"}`;

  return {
    id: node.name,
    shopifyGid: node.id,
    numericId: node.id.split("/").pop(),
    customer: {
      name: customerName,
      email: node.customer?.email || "",
      phone: node.customer?.phone || "",
    },
    orderDate: formatDate(node.createdAt),
    orderDateRaw: node.createdAt,
    total: formatCurrency(node.totalPriceSet),
    paymentStatus: PAYMENT_STATUS_MAP[node.displayFinancialStatus] || "pending",
    fulfillmentStatus:
      FULFILLMENT_STATUS_MAP[node.displayFulfillmentStatus] || "unfulfilled",
    displayFinancialStatus: node.displayFinancialStatus,
    displayFulfillmentStatus: node.displayFulfillmentStatus,
    status: mapCustomStatus(node),
    itemCount: lineItemCount,
    itemsDisplay,
    lineItemDetails: lineItemEdges.map((e) => ({
      title: e.node.title || "",
      quantity: e.node.quantity || 1,
      customAttributes: (e.node.customAttributes || []).filter(
        (a) => !a.key.startsWith("_"),
      ),
    })),
    ...(() => {
      const meta = Object.fromEntries(
        (node.metafields?.edges ?? []).map((e) => [e.node.key, e.node.value]),
      );
      return {
        supplierStatus: meta.supplier_status || "pending",
        supplierName: meta.supplier_name || null,
      };
    })(),
    tags: [],
  };
}

// ─── Mutations (previously server-side) ───────────────────────────────────

const SET_METAFIELDS = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key value }
      userErrors { field message }
    }
  }
`;

export async function setOrderMetafields(shopifyGid, fields) {
  const metafields = fields.map(({ key, value }) => ({
    ownerId: shopifyGid,
    namespace: "suit_admin",
    key,
    value: String(value),
    type: "single_line_text_field",
  }));
  const data = await shopifyGraphQL(SET_METAFIELDS, { metafields });
  const errors = data.metafieldsSet?.userErrors ?? [];
  if (errors.length) throw new Error(errors[0].message);
  return data.metafieldsSet.metafields;
}

export async function setShopMetafield(namespace, key, value) {
  const shopData = await shopifyGraphQL(`query { shop { id } }`);
  const shopId = shopData.shop.id;
  const data = await shopifyGraphQL(SET_METAFIELDS, {
    metafields: [
      {
        ownerId: shopId,
        namespace,
        key,
        type: "json",
        value: JSON.stringify(value),
      },
    ],
  });
  const errors = data.metafieldsSet?.userErrors ?? [];
  if (errors.length) throw new Error(errors[0].message);
  return data.metafieldsSet.metafields;
}

const CREATE_CUSTOMER_MUTATION = `
  mutation CustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id firstName lastName email phone createdAt numberOfOrders amountSpent { amount currencyCode } }
      userErrors { field message }
    }
  }
`;

export async function createCustomer({ firstName, lastName, email, phone }) {
  const input = { firstName, lastName, email };
  if (phone) input.phone = phone;
  const data = await shopifyGraphQL(CREATE_CUSTOMER_MUTATION, { input });
  const { customer, userErrors } = data.customerCreate;
  if (userErrors?.length) {
    const err = new Error(userErrors[0].message);
    err.field = userErrors[0].field?.[0] ?? null;
    throw err;
  }
  return customer;
}

const CREATE_DRAFT_ORDER = `
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name }
      userErrors { field message }
    }
  }
`;

const COMPLETE_DRAFT_ORDER = `
  mutation DraftOrderComplete($id: ID!, $paymentPending: Boolean) {
    draftOrderComplete(id: $id, paymentPending: $paymentPending) {
      draftOrder { order { id name } }
      userErrors { field message }
    }
  }
`;

const UPDATE_ORDER_MUTATION = `
  mutation OrderUpdate($input: OrderInput!) {
    orderUpdate(input: $input) {
      order { id name note tags }
      userErrors { field message }
    }
  }
`;

export async function createDraftOrder(input) {
  const data = await shopifyGraphQL(CREATE_DRAFT_ORDER, { input });
  const { draftOrder, userErrors } = data.draftOrderCreate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return draftOrder;
}

export async function completeDraftOrder(id, paymentPending = true) {
  const data = await shopifyGraphQL(COMPLETE_DRAFT_ORDER, {
    id,
    paymentPending,
  });
  const { draftOrder, userErrors } = data.draftOrderComplete;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return draftOrder.order;
}

export async function updateOrder(id, { note, tags }) {
  const input = { id };
  if (note !== undefined) input.note = note;
  if (tags !== undefined) input.tags = tags;
  const data = await shopifyGraphQL(UPDATE_ORDER_MUTATION, { input });
  const { order, userErrors } = data.orderUpdate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return order;
}

export async function setCustomerProductsMetafield(customerGid, products) {
  const data = await shopifyGraphQL(SET_METAFIELDS, {
    metafields: [
      {
        ownerId: customerGid,
        namespace: "profiles",
        key: "gc_measurements",
        type: "json",
        value: JSON.stringify(products),
      },
    ],
  });
  const errors = data.metafieldsSet?.userErrors ?? [];
  if (errors.length) throw new Error(errors[0].message);
  return data.metafieldsSet.metafields;
}

const GET_ORDERS_FOR_PRODUCT = `
  query GetOrdersForProduct($query: String!, $first: Int!) {
    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          lineItems(first: 20) {
            edges {
              node {
                product { id }
                customAttributes { key value }
              }
            }
          }
        }
      }
    }
  }
`;

export async function getProductFields(shopifyProductGid) {
  const numericId = shopifyProductGid.split("/").pop();
  const data = await shopifyGraphQL(GET_ORDERS_FOR_PRODUCT, {
    query: `product_id:${numericId}`,
    first: 20,
  });
  const keySet = new Set();
  for (const { node: order } of data.orders.edges) {
    for (const { node: item } of order.lineItems.edges) {
      const itemNumericId = item.product?.id?.split("/").pop();
      if (itemNumericId !== numericId) continue;
      for (const attr of item.customAttributes) {
        if (!attr.key.startsWith("_")) keySet.add(attr.key);
      }
    }
  }
  return [...keySet];
}

const GET_ORDER_FOR_SUPPLIER = `
  query GetOrderForSupplier($id: ID!) {
    order(id: $id) {
      id
      name
      customer { firstName lastName email phone }
      shippingAddress { address1 }
      customAttributes { key value }
      lineItems(first: 50) {
        edges { node { id title quantity customAttributes { key value } } }
      }
    }
  }
`;

export async function getOrderForSupplier(shopifyGid) {
  const data = await shopifyGraphQL(GET_ORDER_FOR_SUPPLIER, { id: shopifyGid });
  return data.order;
}

const GET_VEST_RANGES = `
  {
    metaobjects(type: "vest_custom_measurement", first: 250) {
      edges {
        node {
          handle
          fields { key value }
        }
      }
    }
  }
`;

let _vestRangesCache = null;
let _vestRangesCacheAt = 0;
const VEST_CACHE_TTL = 30 * 60 * 1000;

export async function fetchVestRanges() {
  if (_vestRangesCache && Date.now() - _vestRangesCacheAt < VEST_CACHE_TTL) {
    return _vestRangesCache;
  }
  const data = await shopifyGraphQL(GET_VEST_RANGES);
  const entries = data?.metaobjects?.edges ?? [];
  const map = {};
  for (const { node } of entries) {
    const fields = Object.fromEntries(node.fields.map((f) => [f.key, f.value]));
    const label = fields.label;
    const vKey = fields.key ?? node.handle;
    const min = parseFloat(fields.min ?? 0);
    const max = parseFloat(fields.max ?? 0);
    if (!label || isNaN(min) || isNaN(max)) continue;
    const entry = { label, min, max, hint: `${min}–${max}` };
    map[vKey] = entry;
    map[`Vest ${vKey}`] = entry;
    map[label] = entry;
    map[`Vest ${label}`] = entry;
  }
  _vestRangesCache = map;
  _vestRangesCacheAt = Date.now();
  return map;
}

export async function shopifyGqlQuery(query, variables = {}) {
  return shopifyGraphQL(query, variables);
}
