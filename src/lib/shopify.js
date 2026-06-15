const ENDPOINT = "/api/shopify/graphql.json";

const CHECK_SUPERADMIN_QUERY = `
  query CheckSuperAdmin($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          email
          firstName
          lastName
          tags
        }
      }
    }
  }
`;

export async function checkSuperAdmin(email) {
  const data = await shopifyGraphQL(CHECK_SUPERADMIN_QUERY, {
    query: `email:"${email.trim().toLowerCase()}"`,
  });
  const customer = data?.customers?.edges?.[0]?.node;
  if (!customer) return { isAdmin: false, name: "" };
  const isAdmin = customer.tags.some(
    (t) => t.trim().toLowerCase() === "super_admin",
  );
  const name = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
  return { isAdmin, name };
}

// ─── GraphQL query ─────────────────────────────────────────────────────────
// Fetches one page of orders with cursor-based pagination.
// lineItems(first: 10) keeps per-request cost well under Shopify's 1 000-point limit.
const GET_ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
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

// ─── Fabric products query (gc_builder metafield not null, with image) ──────
const GET_FABRIC_PRODUCTS_QUERY = `
  query GetFabricProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          status
          featuredImage {
            url
            altText
          }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
          }
          metafield(namespace: "custom", key: "gc_builder") {
            value
          }
        }
      }
    }
  }
`;

let _fabricProductsCache = null;

export async function fetchFabricProducts() {
  if (_fabricProductsCache) return _fabricProductsCache;
  const all = [];
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const data = await shopifyGraphQL(GET_FABRIC_PRODUCTS_QUERY, {
      first: 50,
      after: cursor,
    });
    const { edges, pageInfo } = data.products;
    for (const { node } of edges) {
      if (!node.metafield?.value) continue;
      all.push({
        id: node.id,
        title: node.title,
        price: node.priceRangeV2?.minVariantPrice?.amount ?? "0",
        currencyCode: node.priceRangeV2?.minVariantPrice?.currencyCode ?? "USD",
        imageUrl: node.featuredImage?.url ?? null,
        imageAlt: node.featuredImage?.altText ?? node.title,
      });
    }
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  _fabricProductsCache = all;
  return all;
}

export function clearFabricProductsCache() {
  _fabricProductsCache = null;
}

const GET_PRODUCT_OPTIONS_QUERY = `
  query GetProductOptions($id: ID!) {
    product(id: $id) {
      options {
        name
        values
      }
    }
  }
`;

export async function fetchProductOptions(productId) {
  const data = await shopifyGraphQL(GET_PRODUCT_OPTIONS_QUERY, {
    id: productId,
  });
  return data?.product?.options ?? [];
}

const GET_PRODUCT_VARIANTS_DETAIL_QUERY = `
  query GetProductVariantsDetail($id: ID!) {
    product(id: $id) {
      options {
        id
        name
        values
        optionValues {
          id
          name
        }
        linkedMetafield {
          namespace
          key
        }
      }
      variants(first: 250) {
        edges {
          node {
            id
            title
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

export async function fetchProductVariantsDetail(productId) {
  const data = await shopifyGraphQL(GET_PRODUCT_VARIANTS_DETAIL_QUERY, {
    id: productId,
  });
  const product = data?.product;
  if (!product) return { options: [], variants: [] };
  return {
    options: product.options ?? [],
    variants: (product.variants?.edges ?? []).map((e) => e.node),
  };
}

// productOptionUpdate — optionValuesToAdd is a TOP-LEVEL arg, NOT inside option: {}
const ADD_OPTION_VALUE_MUTATION = `
  mutation ProductOptionUpdate(
    $productId: ID!
    $option: OptionUpdateInput!
    $optionValuesToAdd: [OptionValueCreateInput!]
    $variantStrategy: ProductOptionUpdateVariantStrategy
  ) {
    productOptionUpdate(
      productId: $productId
      option: $option
      optionValuesToAdd: $optionValuesToAdd
      variantStrategy: $variantStrategy
    ) {
      product {
        options {
          id
          name
          optionValues { id name }
        }
      }
      userErrors { field message code }
    }
  }
`;

// Creates a new ProductOptionValue on a connected option by linking a metaobject.
// Returns the new { id, name } so the caller can immediately create a variant with it.
// Confirmed working syntax from Postman: option: { id } + optionValuesToAdd: [{ linkedMetafieldValue }]
export async function createProductOptionValue(
  productId,
  optionId,
  metaobjectGid,
) {
  const data = await shopifyGraphQL(ADD_OPTION_VALUE_MUTATION, {
    productId,
    option: { id: optionId },
    optionValuesToAdd: [{ linkedMetafieldValue: metaobjectGid }],
    variantStrategy: "LEAVE_AS_IS",
  });
  const { product, userErrors } = data.productOptionUpdate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  // Find the updated option by ID and return its last-added value (newest is last)
  const updatedOption = (product?.options ?? []).find((o) => o.id === optionId);
  const values = updatedOption?.optionValues ?? [];
  if (!values.length) throw new Error("Option value was not created.");
  return values[values.length - 1];
}

const ADD_PRODUCT_VARIANT_MUTATION = `
  mutation ProductVariantsBulkCreate(
    $productId: ID!
    $variants: [ProductVariantsBulkInput!]!
    $media: [CreateMediaInput!]
  ) {
    productVariantsBulkCreate(productId: $productId, variants: $variants, media: $media) {
      productVariants { id title selectedOptions { name value } }
      userErrors { field message }
    }
  }
`;

// patternLabel: for plain-text (non-connected) options.
// imageUrl: if provided, creates media and links it to the variant in one call.
export async function addVariantToProduct(
  productId,
  optionValueId,
  optionName,
  existingVariants,
  patternLabel = null,
  imageUrl = null,
) {
  const primaryValue = patternLabel
    ? { optionName, name: patternLabel }
    : { id: optionValueId, optionName };

  let optionValues = [primaryValue];
  if (existingVariants.length > 0) {
    const otherOpts = existingVariants[0].selectedOptions.filter(
      (o) => o.name !== optionName,
    );
    if (otherOpts.length) {
      optionValues = [
        primaryValue,
        ...otherOpts.map((o) => ({ optionName: o.name, name: o.value })),
      ];
    }
  }

  // When imageUrl is provided: pass it in both `media` (creates product media)
  // and `variants[].mediaSrc` (links that media to this specific variant) in one call.
  const variantInput = imageUrl
    ? { optionValues, mediaSrc: [imageUrl] }
    : { optionValues };

  const variables = { productId, variants: [variantInput] };
  if (imageUrl) {
    variables.media = [{ originalSource: imageUrl, mediaContentType: "IMAGE" }];
  }

  const data = await shopifyGraphQL(ADD_PRODUCT_VARIANT_MUTATION, variables);
  const { productVariants, userErrors } = data.productVariantsBulkCreate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return productVariants;
}

const REMOVE_PRODUCT_VARIANTS_MUTATION = `
  mutation ProductVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
    productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
      product { id }
      userErrors { field message }
    }
  }
`;

export async function removeVariantsFromProduct(productId, variantIds) {
  const data = await shopifyGraphQL(REMOVE_PRODUCT_VARIANTS_MUTATION, {
    productId,
    variantsIds: variantIds,
  });
  const { userErrors } = data.productVariantsBulkDelete;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return data.productVariantsBulkDelete.product;
}

// ─── Products query ────────────────────────────────────────────────────────
const GET_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          status
          priceRangeV2 {
            minVariantPrice {
              amount
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
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
      ...edges
        .map((e) => e.node)
        .filter((p) => p.status === "ACTIVE" || p.status === "ARCHIVED"),
    );
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  _gcProductsCache = all;
  return all;
}

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
    all.push(...edges.map((e) => e.node));
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

// ─── Single-page order fetch (for paginated UI) ────────────────────────────
export async function fetchOrdersPage({
  first = 20,
  after = null,
  searchQuery = "",
}) {
  const variables = { first, after: after || undefined };
  if (searchQuery) variables.query = searchQuery;
  const data = await shopifyGraphQL(GET_ORDERS_QUERY, variables);
  const { edges, pageInfo } = data.orders;
  return {
    orders: edges.map((e) => e.node),
    hasNextPage: pageInfo.hasNextPage,
    endCursor: pageInfo.endCursor,
  };
}

// ─── Customer queries ──────────────────────────────────────────────────────
const GET_CUSTOMERS_QUERY = `
  query GetCustomers($first: Int!, $after: String, $query: String) {
    customers(first: $first, after: $after, sortKey: CREATED_AT, reverse: true, query: $query) {
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

const GET_CUSTOMERS_COUNT_QUERY = `
  query GetCustomersCount($query: String) {
    customersCount(query: $query) {
      count
      precision
    }
  }
`;

export async function fetchCustomersCount(searchQuery = "") {
  const variables = {};
  if (searchQuery.trim()) variables.query = searchQuery.trim();
  const data = await shopifyGraphQL(GET_CUSTOMERS_COUNT_QUERY, variables);
  return data?.customersCount?.count ?? null;
}

export async function fetchCustomersPage({
  cursor = null,
  pageSize = 20,
  searchQuery = "",
} = {}) {
  const variables = { first: pageSize, after: cursor };
  if (searchQuery.trim()) variables.query = searchQuery.trim();
  const data = await shopifyGraphQL(GET_CUSTOMERS_QUERY, variables);
  const { edges, pageInfo } = data.customers;
  return { customers: edges.map((e) => e.node), pageInfo };
}

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
                  variant { title }
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
  const all = [];
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const data = await shopifyGraphQL(GET_CUSTOMERS_QUERY, {
      first: 50,
      after: cursor,
    });
    const { edges, pageInfo } = data.customers;
    all.push(...edges.map((e) => e.node));
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
    allOrders.push(...edges.map((e) => e.node));
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

const PAYMENT_STATUS_MAP = {
  PAID: "paid",
  UNPAID: "pending",
  PENDING: "pending",
  AUTHORIZED: "pending",
  PARTIALLY_PAID: "pending",
  PARTIALLY_REFUNDED: "pending",
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

function mapCustomStatus(node) {
  if (
    node.displayFinancialStatus === "REFUNDED" ||
    node.displayFinancialStatus === "VOIDED"
  ) {
    return "failed";
  }
  if (node.displayFulfillmentStatus === "FULFILLED") return "shipped";
  return "processing";
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

  const upchargeRaw = lineItemEdges.reduce((sum, e) => {
    return (
      sum +
      (e.node.customAttributes ?? [])
        .filter((a) => a.key.startsWith("_upcharge_"))
        .reduce((s, a) => s + parseFloat(a.value || 0), 0)
    );
  }, 0);
  const currencyCode = node.totalPriceSet?.shopMoney?.currencyCode || "USD";
  const subtotalRaw = parseFloat(node.subtotalPriceSet?.shopMoney?.amount || 0);

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
    currencyCode,
    upchargeRaw,
    subtotalRaw,
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

export async function createCustomer({
  firstName,
  lastName,
  email,
  phone,
  country,
}) {
  const input = { firstName, lastName, email };
  if (phone) input.phone = phone;
  if (country) input.addresses = [{ country }];
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

const GET_CUSTOMER_GC_MEASUREMENTS = `
  query GetCustomerGcMeasurements($id: ID!) {
    customer(id: $id) {
      metafield(namespace: "profiles", key: "gc_measurements") {
        value
      }
    }
  }
`;

export async function fetchCustomerGcMeasurements(customerGid) {
  const data = await shopifyGraphQL(GET_CUSTOMER_GC_MEASUREMENTS, {
    id: customerGid,
  });
  const raw = data?.customer?.metafield?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function setCustomerProductsMetafield(customerGid, products) {
  const payload = JSON.stringify(products);
  const data = await shopifyGraphQL(SET_METAFIELDS, {
    metafields: [
      {
        ownerId: customerGid,
        namespace: "profiles",
        key: "gc_measurements",
        type: "json",
        value: payload,
      },
    ],
  });
  const result = data.metafieldsSet;
  const errors = result?.userErrors ?? [];
  if (!result) throw new Error("Shopify returned no metafieldsSet response");
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
  return result.metafields;
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

      const sizeType = (item.customAttributes ?? [])
        .find((a) => a.key.toLowerCase() === "size type")
        ?.value?.toLowerCase();
      if (sizeType === "standard") continue;

      for (const attr of item.customAttributes) {
        if (
          !attr.key.startsWith("_") &&
          !attr.key.toLowerCase().startsWith("standard")
        )
          keySet.add(attr.key);
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
let _vestFieldsListCache = null;
let _vestRangesCacheAt = 0;
const VEST_CACHE_TTL = 30 * 60 * 1000;

async function _loadVestData() {
  const data = await shopifyGraphQL(GET_VEST_RANGES);
  const entries = data?.metaobjects?.edges ?? [];
  const map = {};
  const fieldsList = [];
  for (const { node } of entries) {
    const fm = {};
    for (const f of node.fields) {
      if (f.key === "label" || f.key === "min" || f.key === "max")
        fm[f.key] = f.value;
    }
    const label = (fm.label ?? "").trim();
    const min = parseFloat(fm.min ?? 0);
    const max = parseFloat(fm.max ?? 0);
    const vKey = node.handle;
    if (!label || isNaN(min) || isNaN(max)) continue;
    const entry = { label, min, max, hint: `${min}–${max}` };
    map[vKey] = entry;
    map[label] = entry;
    map[`Vest ${label}`] = entry;
    fieldsList.push({ key: vKey, label, min, max });
  }
  _vestRangesCache = map;
  _vestFieldsListCache = fieldsList;
  _vestRangesCacheAt = Date.now();
}

export async function fetchVestRanges() {
  if (_vestRangesCache && Date.now() - _vestRangesCacheAt < VEST_CACHE_TTL)
    return _vestRangesCache;
  await _loadVestData();
  return _vestRangesCache;
}

export async function fetchVestMeasurementFields() {
  if (_vestFieldsListCache) return _vestFieldsListCache;
  await _loadVestData();
  return _vestFieldsListCache;
}

const GET_SHIRT_RANGES = `
  {
    metaobjects(type: "shirt_custom_measurement", first: 250) {
      edges {
        node {
          handle
          fields { key value }
        }
      }
    }
  }
`;

let _shirtRangesCache = null;
let _shirtFieldsListCache = null;
let _shirtRangesCacheAt = 0;
const SHIRT_CACHE_TTL = 30 * 60 * 1000;

async function _loadShirtData() {
  const data = await shopifyGraphQL(GET_SHIRT_RANGES);
  const entries = data?.metaobjects?.edges ?? [];
  const map = {};
  const fieldsList = [];
  for (const { node } of entries) {
    const fm = {};
    for (const f of node.fields) {
      if (f.key === "label" || f.key === "min" || f.key === "max")
        fm[f.key] = f.value;
    }
    const label = (fm.label ?? "").trim();
    const min = parseFloat(fm.min ?? 0);
    const max = parseFloat(fm.max ?? 0);
    const sKey = node.handle;
    if (!label || isNaN(min) || isNaN(max)) continue;
    const entry = { label, min, max, hint: `${min}–${max}` };
    map[sKey] = entry;
    map[label] = entry;
    map[`Shirt ${label}`] = entry;
    fieldsList.push({ key: sKey, label, min, max });
  }
  _shirtRangesCache = map;
  _shirtFieldsListCache = fieldsList;
  _shirtRangesCacheAt = Date.now();
}

export async function fetchShirtRanges() {
  if (_shirtRangesCache && Date.now() - _shirtRangesCacheAt < SHIRT_CACHE_TTL)
    return _shirtRangesCache;
  await _loadShirtData();
  return _shirtRangesCache;
}

export async function fetchShirtMeasurementFields() {
  if (_shirtFieldsListCache) return _shirtFieldsListCache;
  await _loadShirtData();
  return _shirtFieldsListCache;
}

const GET_TROUSER_RANGES = `
  {
    metaobjects(type: "trouser_custom_measurement", first: 250) {
      edges {
        node {
          handle
          fields { key value }
        }
      }
    }
  }
`;

let _trouserRangesCache = null;
let _trouserFieldsListCache = null;
let _trouserRangesCacheAt = 0;
const TROUSER_CACHE_TTL = 30 * 60 * 1000;

async function _loadTrouserData() {
  const data = await shopifyGraphQL(GET_TROUSER_RANGES);
  const entries = data?.metaobjects?.edges ?? [];
  const map = {};
  const fieldsList = [];
  for (const { node } of entries) {
    const fm = {};
    for (const f of node.fields) {
      if (f.key === "label" || f.key === "min" || f.key === "max")
        fm[f.key] = f.value;
    }
    const label = (fm.label ?? "").trim();
    const min = parseFloat(fm.min ?? 0);
    const max = parseFloat(fm.max ?? 0);
    const tKey = node.handle;
    if (!label || isNaN(min) || isNaN(max)) continue;
    const entry = { label, min, max, hint: `${min}–${max}` };
    map[tKey] = entry;
    map[label] = entry;
    map[`Trouser ${label}`] = entry;
    fieldsList.push({ key: tKey, label, min, max });
  }
  _trouserRangesCache = map;
  _trouserFieldsListCache = fieldsList;
  _trouserRangesCacheAt = Date.now();
}

export async function fetchTrouserRanges() {
  if (
    _trouserRangesCache &&
    Date.now() - _trouserRangesCacheAt < TROUSER_CACHE_TTL
  )
    return _trouserRangesCache;
  await _loadTrouserData();
  return _trouserRangesCache;
}

export async function fetchTrouserMeasurementFields() {
  if (_trouserFieldsListCache) return _trouserFieldsListCache;
  await _loadTrouserData();
  return _trouserFieldsListCache;
}

const GET_JACKET_RANGES = `
  {
    metaobjects(type: "jacket_custom_measurement", first: 250) {
      edges {
        node {
          handle
          fields { key value }
        }
      }
    }
  }
`;

let _jacketRangesCache = null;
let _jacketFieldsListCache = null;
let _jacketRangesCacheAt = 0;
const JACKET_CACHE_TTL = 30 * 60 * 1000;

async function _loadJacketData() {
  const data = await shopifyGraphQL(GET_JACKET_RANGES);
  const entries = data?.metaobjects?.edges ?? [];
  const map = {};
  const fieldsList = [];
  for (const { node } of entries) {
    const fm = {};
    for (const f of node.fields) {
      if (
        f.key === "key" ||
        f.key === "label" ||
        f.key === "min" ||
        f.key === "max"
      )
        fm[f.key] = f.value;
    }
    const label = (fm.label ?? "").trim();
    const min = parseFloat(fm.min ?? 0);
    const max = parseFloat(fm.max ?? 0);
    const handle = node.handle;
    const canonicalKey = fm.key ? fm.key.replace(/\s/g, "") : handle;
    if (!label || isNaN(min) || isNaN(max)) continue;
    const entry = { label, min, max, hint: `${min}–${max}` };
    map[handle] = entry;
    map[canonicalKey] = entry;
    map[label] = entry;
    map[`Jacket ${label}`] = entry;
    fieldsList.push({ key: canonicalKey, label, min, max });
  }
  _jacketRangesCache = map;
  _jacketFieldsListCache = fieldsList;
  _jacketRangesCacheAt = Date.now();
}

export async function fetchJacketRanges() {
  if (
    _jacketRangesCache &&
    Date.now() - _jacketRangesCacheAt < JACKET_CACHE_TTL
  )
    return _jacketRangesCache;
  await _loadJacketData();
  return _jacketRangesCache;
}

export async function fetchJacketMeasurementFields() {
  if (_jacketFieldsListCache) return _jacketFieldsListCache;
  await _loadJacketData();
  return _jacketFieldsListCache;
}

export async function shopifyGqlQuery(query, variables = {}) {
  return shopifyGraphQL(query, variables);
}

const STYLE_OPTION_TYPES = [
  "gc_jacket_style_option",
  "gc_trouser_style_option",
  "gc_shirt_style_option",
];

export const GARMENT_TO_STYLE_TYPE = Object.fromEntries(
  STYLE_OPTION_TYPES.map((type) => [garmentFromType(type), type]),
);

function garmentFromType(type) {
  return type
    .replace(/^gc_/, "")
    .replace(/_style_option$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STYLE_OPTIONS_QUERY = `
  query GetStyleOptions($type: String!, $first: Int!, $after: String) {
    metaobjects(type: $type, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          fields { key value type }
        }
      }
    }
  }
`;

const UPDATE_METAOBJECT_MUTATION = `
  mutation MetaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

let _styleOptionsCache = null;
let _styleOptionsCacheAt = 0;
const STYLE_OPTIONS_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function fetchStyleOptionsForType(type) {
  const garment = garmentFromType(type);
  const results = [];
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const data = await shopifyGraphQL(STYLE_OPTIONS_QUERY, {
      type,
      first: 250,
      after: cursor,
    });
    const { edges, pageInfo } = data.metaobjects;
    for (const { node } of edges) {
      const fm = Object.fromEntries(
        node.fields.map((f) => [f.key, f.value ?? ""]),
      );
      const fieldTypes = Object.fromEntries(
        node.fields.map((f) => [
          f.key,
          f.type ? f.type.toLowerCase().trim() : null,
        ]),
      );
      results.push({
        id: node.id,
        handle: node.handle,
        label: fm.label || node.handle,
        category: fm.category || "",
        garment,
        displayLabel: fm.display_label || fm.category || "",
        upcharge: parseFloat(fm.upcharge || 0),
        visible: fm.visible !== "false",
        isDefault: fm.is_default === "true",
        sortOrder: parseInt(fm.sort_order || "0", 10),
        kutetailerCode: fm.kutetailer_code || null,
        conditionalHide: fm.conditional_hide || "",
        imageGid: fm.image || null,
        imageUrlStored: fm.image_url || null,
        imageUrl:
          fm.image_url ||
          (fm.kutetailer_code
            ? `https://aws-static-webp.kutetailor.com/comm/process/craft/${fm.kutetailer_code}.jpeg`
            : null),
        rawFields: fm,
        fieldTypes,
      });
    }
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  return results;
}

const GET_FILE_URLS_QUERY = `
  query GetFileUrls($ids: [ID!]!) {
    nodes(ids: $ids) {
      id
      ... on MediaImage {
        image { url }
      }
    }
  }
`;

async function resolveFileGidUrls(gids) {
  const map = {};
  if (!gids.length) return map;
  for (let i = 0; i < gids.length; i += 250) {
    const batch = gids.slice(i, i + 250);
    try {
      const data = await shopifyGraphQL(GET_FILE_URLS_QUERY, { ids: batch });
      for (const node of data.nodes ?? []) {
        if (node?.image?.url) map[node.id] = node.image.url;
      }
    } catch {
      // non-fatal — missing URLs just won't display
    }
  }
  return map;
}

export async function fetchStyleOptions() {
  if (
    _styleOptionsCache &&
    Date.now() - _styleOptionsCacheAt < STYLE_OPTIONS_CACHE_TTL
  ) {
    return _styleOptionsCache;
  }

  const [results, ...defsResults] = await Promise.all([
    Promise.all(STYLE_OPTION_TYPES.map(fetchStyleOptionsForType)),
    ...STYLE_OPTION_TYPES.map((t) =>
      fetchStyleOptionFieldDefs(t).catch(() => []),
    ),
  ]);

  const defsTypeMap = {};
  STYLE_OPTION_TYPES.forEach((garmentType, i) => {
    const defs = defsResults[i] ?? [];
    defsTypeMap[garmentType] = Object.fromEntries(
      defs
        .filter((d) => d.type?.name)
        .map((d) => [d.key, d.type.name.toLowerCase().trim()]),
    );
  });

  let all = results.flat().map((o) => {
    const garmentType = GARMENT_TO_STYLE_TYPE[o.garment];
    const defsTypes = defsTypeMap[garmentType] ?? {};
    const merged = { ...o.fieldTypes };
    for (const [k, t] of Object.entries(defsTypes)) {
      merged[k] = t;
    }
    return { ...o, fieldTypes: merged };
  });

  const gidsToResolve = [
    ...new Set(
      all.filter((o) => o.imageGid && !o.imageUrlStored).map((o) => o.imageGid),
    ),
  ];
  if (gidsToResolve.length) {
    const urlMap = await resolveFileGidUrls(gidsToResolve);
    all = all.map((o) => {
      if (o.imageGid && !o.imageUrlStored && urlMap[o.imageGid]) {
        return {
          ...o,
          imageUrlStored: urlMap[o.imageGid],
          imageUrl: urlMap[o.imageGid],
        };
      }
      return o;
    });
  }

  _styleOptionsCache = all;
  _styleOptionsCacheAt = Date.now();
  return all;
}

export function clearStyleOptionsCache() {
  _styleOptionsCache = null;
  _styleOptionsCacheAt = 0;
  _contrastOptionsCache = null;
  _contrastOptionsCacheAt = 0;
  _fieldDefsCache.clear(); // force re-fetch so new Shopify fields appear immediately
}

// ─── Contrast Options (gc_contrast_option) ────────────────────────────────

const CONTRAST_OPTIONS_QUERY = `
  query GetContrastOptions($first: Int!, $after: String) {
    metaobjects(type: "gc_contrast_option", first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          fields { key value }
        }
      }
    }
  }
`;

let _contrastOptionsCache = null;
let _contrastOptionsCacheAt = 0;

export async function fetchContrastOptions() {
  if (
    _contrastOptionsCache &&
    Date.now() - _contrastOptionsCacheAt < STYLE_OPTIONS_CACHE_TTL
  ) {
    return _contrastOptionsCache;
  }

  const results = [];
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const data = await shopifyGraphQL(CONTRAST_OPTIONS_QUERY, {
      first: 250,
      after: cursor,
    });
    const { edges, pageInfo } = data.metaobjects;
    for (const { node } of edges) {
      const fm = Object.fromEntries(
        node.fields.map((f) => [f.key, f.value ?? ""]),
      );
      results.push({
        id: node.id,
        handle: node.handle,
        label: fm.color_name || node.handle,
        category: "contrast_option",
        garment: fm.garment || "",
        displayLabel: "Color",
        upcharge: 0,
        visible: fm.visible !== "false",
        isDefault: false,
        sortOrder: 9999,
        kutetailerCode: null,
        conditionalHide: "",
        imageGid: fm.color_image || null,
        imageUrlStored: null,
        imageUrl: null,
        rawFields: fm,
        fieldTypes: {
          color_image: "file_reference",
          color_hex: "color",
          color_name: "single_line_text_field",
          visible: "boolean",
          garment: "single_line_text_field",
        },
        isContrastOption: true,
        colorHex: fm.color_hex || null,
      });
    }
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  // Resolve color_image GIDs → CDN URLs
  const gids = [
    ...new Set(results.filter((r) => r.imageGid).map((r) => r.imageGid)),
  ];
  if (gids.length) {
    const urlMap = await resolveFileGidUrls(gids);
    for (const r of results) {
      if (r.imageGid && urlMap[r.imageGid]) {
        r.imageUrl = urlMap[r.imageGid];
        r.imageUrlStored = urlMap[r.imageGid];
      }
    }
  }

  _contrastOptionsCache = results;
  _contrastOptionsCacheAt = Date.now();
  return results;
}

// ─── Lining Codes (lining_code) ───────────────────────────────────────────

const LINING_CODES_QUERY = `
  query GetLiningCodes($first: Int!, $after: String) {
    metaobjects(type: "lining_code", first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          fields { key value }
        }
      }
    }
  }
`;

let _liningCodesCache = null;
let _liningCodesCacheAt = 0;

export async function fetchLiningCodes() {
  if (
    _liningCodesCache &&
    Date.now() - _liningCodesCacheAt < STYLE_OPTIONS_CACHE_TTL
  ) {
    return _liningCodesCache;
  }

  const results = [];
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const data = await shopifyGraphQL(LINING_CODES_QUERY, {
      first: 250,
      after: cursor,
    });
    const { edges, pageInfo } = data.metaobjects;
    for (const { node } of edges) {
      const fm = Object.fromEntries(
        node.fields.map((f) => [f.key, f.value ?? ""]),
      );
      let garments = [];
      try {
        const parsed = JSON.parse(fm.garment || "[]");
        garments = Array.isArray(parsed) ? parsed : [];
      } catch {}
      results.push({
        id: node.id,
        handle: node.handle,
        label: fm.color_name || fm.code || node.handle,
        code: fm.code || "",
        category: "lining_code",
        garments,
        garment: "",
        displayLabel: "Lining Code",
        upcharge: 0,
        visible: fm.visible !== "false",
        isDefault: fm.is_default === "true",
        sortOrder: 9999,
        imageGid: fm.image || null,
        imageUrl: null,
        imageUrlStored: null,
        rawFields: fm,
        fieldTypes: {},
        isLiningCode: true,
      });
    }
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  const gids = [
    ...new Set(results.filter((r) => r.imageGid).map((r) => r.imageGid)),
  ];
  if (gids.length) {
    const urlMap = await resolveFileGidUrls(gids);
    for (const r of results) {
      if (r.imageGid && urlMap[r.imageGid]) {
        r.imageUrl = urlMap[r.imageGid];
        r.imageUrlStored = urlMap[r.imageGid];
      }
    }
  }

  _liningCodesCache = results;
  _liningCodesCacheAt = Date.now();
  return results;
}

export function clearLiningCodesCache() {
  _liningCodesCache = null;
  _liningCodesCacheAt = 0;
}

// ─── Fit Size Options ─────────────────────────────────────────────────────

const FIT_SIZE_OPTIONS_QUERY = `
  query GetFitSizeOptions($first: Int!, $after: String) {
    metaobjects(type: "fit_size_options", first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          fields { key value }
        }
      }
    }
  }
`;

let _fitSizeOptionsCache = null;
let _fitSizeOptionsCacheAt = 0;

export async function fetchFitSizeOptions() {
  if (
    _fitSizeOptionsCache &&
    Date.now() - _fitSizeOptionsCacheAt < STYLE_OPTIONS_CACHE_TTL
  ) {
    return _fitSizeOptionsCache;
  }
  const results = [];
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const data = await shopifyGraphQL(FIT_SIZE_OPTIONS_QUERY, {
      first: 250,
      after: cursor,
    });
    const { edges, pageInfo } = data.metaobjects;
    for (const { node } of edges) {
      const fm = Object.fromEntries(
        node.fields.map((f) => [f.key, f.value ?? ""]),
      );
      results.push({
        id: node.id,
        handle: node.handle,
        garment: fm.garment || "",
        sizeType: fm.size_type || "",
        label: fm.label || "",
        sizeLabel: fm.size_label || null,
      });
    }
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  _fitSizeOptionsCache = results;
  _fitSizeOptionsCacheAt = Date.now();
  return results;
}

export async function updateContrastOption(id, fields) {
  const fieldInputs = Object.entries(fields).map(([key, value]) => ({
    key,
    value: value == null ? null : String(value),
  }));
  const data = await shopifyGraphQL(UPDATE_METAOBJECT_MUTATION, {
    id,
    metaobject: { fields: fieldInputs },
  });
  const { userErrors } = data.metaobjectUpdate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return data.metaobjectUpdate.metaobject;
}

export async function updateStyleOptionVisible(id, visible) {
  const data = await shopifyGraphQL(UPDATE_METAOBJECT_MUTATION, {
    id,
    metaobject: { fields: [{ key: "visible", value: String(visible) }] },
  });
  const { userErrors } = data.metaobjectUpdate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return data.metaobjectUpdate.metaobject;
}

const GET_METAOBJECT_FIELD_DEFS = `
  query GetMetaobjectDef($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      fieldDefinitions {
        key
        name
        required
        type { name }
      }
    }
  }
`;

const _fieldDefsCache = new Map();
const FIELD_DEFS_CACHE_TTL = 30 * 1000;

export async function fetchStyleOptionFieldDefs(garmentType) {
  const cached = _fieldDefsCache.get(garmentType);
  if (cached && Date.now() - cached.cachedAt < FIELD_DEFS_CACHE_TTL) {
    return cached.defs;
  }
  const data = await shopifyGraphQL(GET_METAOBJECT_FIELD_DEFS, {
    type: garmentType,
  });
  const defs = data?.metaobjectDefinitionByType?.fieldDefinitions ?? [];
  _fieldDefsCache.set(garmentType, { defs, cachedAt: Date.now() });
  return defs;
}

const CREATE_METAOBJECT_MUTATION = `
  mutation MetaobjectCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle fields { key value } }
      userErrors { field message }
    }
  }
`;

const DELETE_METAOBJECT_MUTATION = `
  mutation MetaobjectDelete($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors { field message }
    }
  }
`;

export async function deleteStyleOption(id) {
  const data = await shopifyGraphQL(DELETE_METAOBJECT_MUTATION, { id });
  const { userErrors } = data.metaobjectDelete;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return data.metaobjectDelete.deletedId;
}

export async function updateStyleOption(id, fields) {
  const fieldInputs = Object.entries(fields).map(([key, value]) => ({
    key,
    value: String(value),
  }));
  const data = await shopifyGraphQL(UPDATE_METAOBJECT_MUTATION, {
    id,
    metaobject: { fields: fieldInputs },
  });
  const { userErrors } = data.metaobjectUpdate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return data.metaobjectUpdate.metaobject;
}

const STAGED_UPLOADS_CREATE = `
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE = `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id }
      userErrors { field message }
    }
  }
`;

export async function uploadImageToShopify(file) {
  const stageData = await shopifyGraphQL(STAGED_UPLOADS_CREATE, {
    input: [
      {
        filename: file.name,
        mimeType: file.type,
        resource: "IMAGE",
        httpMethod: "POST",
      },
    ],
  });
  const { stagedTargets, userErrors: stageErrors } =
    stageData.stagedUploadsCreate;
  if (stageErrors?.length) throw new Error(stageErrors[0].message);
  const target = stagedTargets[0];

  const fd = new FormData();
  for (const { name, value } of target.parameters) fd.append(name, value);
  fd.append("file", file);
  const uploadRes = await fetch(target.url, { method: "POST", body: fd });
  if (!uploadRes.ok)
    throw new Error(`Image upload failed (${uploadRes.status})`);

  const fileData = await shopifyGraphQL(FILE_CREATE, {
    files: [{ originalSource: target.resourceUrl, contentType: "IMAGE" }],
  });
  const { files, userErrors: fileErrors } = fileData.fileCreate;
  if (fileErrors?.length) throw new Error(fileErrors[0].message);

  return { gid: files[0].id, cdnUrl: target.resourceUrl };
}

let _shopDomain = null;

export async function fetchShopAdminDomain() {
  if (_shopDomain) return _shopDomain;
  const data = await shopifyGraphQL(`query { shop { myshopifyDomain } }`);
  _shopDomain = data.shop.myshopifyDomain;
  return _shopDomain;
}

export async function createStyleOption(garmentType, fields) {
  const fieldInputs = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([key, value]) => ({ key, value: String(value) }));
  const data = await shopifyGraphQL(CREATE_METAOBJECT_MUTATION, {
    metaobject: {
      type: garmentType,
      fields: fieldInputs,
      capabilities: { publishable: { status: "ACTIVE" } },
    },
  });
  const { metaobject, userErrors } = data.metaobjectCreate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return metaobject;
}

const SHOPIFY_COLOR_PATTERN_QUERY = `
  query ShopifyColorPattern($first: Int!, $after: String) {
    metaobjects(type: "shopify-color-pattern", first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          displayName
          fields {
            key
            value
          }
        }
      }
    }
  }
`;

const RESOLVE_MEDIA_IMAGES_QUERY = `
  query ResolveMediaImages($ids: [ID!]!) {
    nodes(ids: $ids) {
      id
      ... on MediaImage {
        image {
          url
          altText
        }
      }
    }
  }
`;

let _shopifyColorPatternCache = null;

export async function fetchShopifyColorPattern() {
  if (_shopifyColorPatternCache) return _shopifyColorPatternCache;
  const all = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const data = await shopifyGraphQL(SHOPIFY_COLOR_PATTERN_QUERY, {
      first: 250,
      after: cursor,
    });
    const { edges, pageInfo } = data.metaobjects;
    for (const { node } of edges) {
      const fieldMap = Object.fromEntries(
        node.fields.map((f) => [f.key, f.value]),
      );
      const imageGid =
        typeof fieldMap.image === "string" &&
        fieldMap.image.startsWith("gid://")
          ? fieldMap.image
          : null;
      all.push({
        id: node.id,
        handle: node.handle,
        label: fieldMap.label ?? node.displayName,
        color: fieldMap.color ?? null,
        code: fieldMap.code ?? null,
        imageUrl: null,
        imageGid: imageGid,
        imageAlt: node.displayName,
        _imageGid: imageGid,
      });
    }
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  // Resolve image GIDs via nodes query
  const toResolve = all.filter((f) => f._imageGid);
  if (toResolve.length) {
    try {
      const ids = toResolve.map((f) => f._imageGid);
      const data = await shopifyGraphQL(RESOLVE_MEDIA_IMAGES_QUERY, { ids });
      const urlMap = Object.fromEntries(
        (data.nodes ?? [])
          .filter((n) => n?.image?.url)
          .map((n) => [n.id, { url: n.image.url, alt: n.image.altText }]),
      );
      for (const f of all) {
        if (f._imageGid && urlMap[f._imageGid]) {
          f.imageUrl = urlMap[f._imageGid].url;
          f.imageAlt = urlMap[f._imageGid].alt ?? f.imageAlt;
          f.imageGid = f._imageGid;
        }
      }
    } catch {
      // falls back to color swatch
    }
  }

  for (const f of all) delete f._imageGid;
  _shopifyColorPatternCache = all;
  return all;
}

export function clearShopifyColorPatternCache() {
  _shopifyColorPatternCache = null;
}

export async function syncStyleOptionImageUrls(options) {
  const toSync = options.filter((o) => o.kutetailerCode && !o.imageUrlStored);
  if (!toSync.length) return 0;
  const results = await Promise.allSettled(
    toSync.map((o) =>
      shopifyGraphQL(UPDATE_METAOBJECT_MUTATION, {
        id: o.id,
        metaobject: {
          fields: [
            {
              key: "image_url",
              value: `https://aws-static-webp.kutetailor.com/comm/process/craft/${o.kutetailerCode}.jpeg`,
            },
          ],
        },
      }),
    ),
  );
  const failed = results.filter(
    (r) =>
      r.status === "rejected" || r.value?.metaobjectUpdate?.userErrors?.length,
  );
  if (failed.length) throw new Error(`${failed.length} update(s) failed`);
  return toSync.length;
}

// ─── Order Editing API ────────────────────────────────────────────────────────

const ORDER_EDIT_BEGIN = `
  mutation OrderEditBegin($id: ID!) {
    orderEditBegin(id: $id) {
      calculatedOrder { id }
      userErrors { field message }
    }
  }
`;

const ORDER_EDIT_ADD_CUSTOM_ITEM = `
  mutation OrderEditAddCustomItem(
    $id: ID!
    $title: String!
    $price: MoneyInput!
    $quantity: Int!
  ) {
    orderEditAddCustomItem(
      id: $id
      title: $title
      price: $price
      quantity: $quantity
      requiresShipping: false
      taxable: false
    ) {
      calculatedOrder { id }
      userErrors { field message }
    }
  }
`;

const ORDER_EDIT_COMMIT = `
  mutation OrderEditCommit($id: ID!, $notifyCustomer: Boolean) {
    orderEditCommit(id: $id, notifyCustomer: $notifyCustomer) {
      order {
        id
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount currencyCode } }
      }
      userErrors { field message }
    }
  }
`;

export async function addUpchargeLineItem(orderId, amount, currencyCode) {
  const beginData = await shopifyGraphQL(ORDER_EDIT_BEGIN, { id: orderId });
  const beginErrors = beginData.orderEditBegin?.userErrors ?? [];
  if (beginErrors.length) throw new Error(beginErrors[0].message);
  const calculatedId = beginData.orderEditBegin.calculatedOrder.id;

  const addData = await shopifyGraphQL(ORDER_EDIT_ADD_CUSTOM_ITEM, {
    id: calculatedId,
    title: "Upcharge",
    price: { amount: amount.toFixed(2), currencyCode },
    quantity: 1,
  });
  const addErrors = addData.orderEditAddCustomItem?.userErrors ?? [];
  if (addErrors.length) throw new Error(addErrors[0].message);

  const commitData = await shopifyGraphQL(ORDER_EDIT_COMMIT, {
    id: calculatedId,
    notifyCustomer: false,
  });
  const commitErrors = commitData.orderEditCommit?.userErrors ?? [];
  if (commitErrors.length) throw new Error(commitErrors[0].message);

  return commitData.orderEditCommit.order;
}

export async function createColorPattern({ label, color, imageGid, code }) {
  const fields = [{ key: "label", value: label }];
  if (color) fields.push({ key: "color", value: color });
  if (imageGid) fields.push({ key: "image", value: imageGid });
  if (code) fields.push({ key: "code", value: code });
  const data = await shopifyGraphQL(CREATE_METAOBJECT_MUTATION, {
    metaobject: {
      type: "shopify-color-pattern",
      fields,
      capabilities: { publishable: { status: "ACTIVE" } },
    },
  });
  const { metaobject, userErrors } = data.metaobjectCreate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return metaobject;
}

export async function updateColorPattern(id, { label, color, imageGid, code }) {
  const fieldInputs = [
    { key: "label", value: label || "" },
    { key: "color", value: color == null ? null : color },
    { key: "image", value: imageGid == null ? null : imageGid },
    { key: "code", value: code == null ? null : code },
  ];
  const data = await shopifyGraphQL(UPDATE_METAOBJECT_MUTATION, {
    id,
    metaobject: { fields: fieldInputs },
  });
  const { userErrors } = data.metaobjectUpdate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return data.metaobjectUpdate.metaobject;
}

export async function deleteColorPattern(id) {
  const data = await shopifyGraphQL(DELETE_METAOBJECT_MUTATION, { id });
  const { userErrors } = data.metaobjectDelete;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return data.metaobjectDelete.deletedId;
}

export const fetchFabricOptions = fetchShopifyColorPattern;
export const clearFabricOptionsCache = clearShopifyColorPatternCache;
