import { config } from "../config.js";

const ENDPOINT = `${config.shopify.storeDomain}/admin/api/${config.shopify.apiVersion}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.shopify.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

const GET_ORDER_QUERY = `
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      customer { firstName lastName email phone }
      lineItems(first: 50) {
        edges {
          node {
            id
            title
            quantity
            customAttributes { key value }
          }
        }
      }
      metafields(first: 10, namespace: "suit_admin") {
        edges { node { key value } }
      }
    }
  }
`;

const SET_METAFIELDS = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key value }
      userErrors { field message }
    }
  }
`;

export async function getOrder(shopifyGid) {
  const data = await gql(GET_ORDER_QUERY, { id: shopifyGid });
  return data.order;
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
  const data = await gql(CREATE_CUSTOMER_MUTATION, { input });
  const { customer, userErrors } = data.customerCreate;
  if (userErrors?.length) {
    const err = new Error(userErrors[0].message);
    err.field = userErrors[0].field?.[0] ?? null;
    throw err;
  }
  return customer;
}

export async function setOrderMetafields(shopifyGid, fields) {
  const metafields = fields.map(({ key, value }) => ({
    ownerId: shopifyGid,
    namespace: "suit_admin",
    key,
    value: String(value),
    type: "single_line_text_field",
  }));
  const data = await gql(SET_METAFIELDS, { metafields });
  const errors = data.metafieldsSet?.userErrors ?? [];
  if (errors.length) throw new Error(errors[0].message);
  return data.metafieldsSet.metafields;
}

export async function setCustomerProductsMetafield(customerGid, products) {
  const data = await gql(SET_METAFIELDS, {
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

const GET_ALL_CUSTOMER_IDS = `
  query GetAllCustomerIds($first: Int!, $after: String) {
    customers(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id numberOfOrders } }
    }
  }
`;

const GET_CUSTOMER_ORDERS_SYNC = `
  query GetCustomerOrdersSync($id: ID!, $first: Int!, $after: String) {
    customer(id: $id) {
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            createdAt
            lineItems(first: 20) {
              edges {
                node {
                  title
                  product {
                    metafield(namespace: "custom", key: "gc_builder") { value }
                  }
                  customAttributes { key value }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function buildProfilesFromOrders(orders) {
  const result = {};
  let counter = Math.floor(Date.now() / 1000);

  for (const order of orders) {
    const created = (order.createdAt ?? "").split("T")[0];
    for (const { node: item } of order.lineItems?.edges ?? []) {
      if (!item.product?.metafield?.value) continue;
      const allAttrs = item.customAttributes ?? [];
      const measureAttrs = allAttrs.filter((a) => !a.key.startsWith("_"));
      if (!measureAttrs.length) continue;

      const productName = item.title;
      if (!result[productName]) result[productName] = [];
      if (result[productName].length >= 5) continue;

      const profileName = allAttrs.find(
        (a) => a.key === "_profile_name",
      )?.value;
      const idx = result[productName].length + 1;
      const measurements = Object.fromEntries(
        measureAttrs.map(({ key, value }) => [
          key,
          value?.endsWith('"') ? value.slice(0, -1) : value,
        ]),
      );

      result[productName].push({
        id: `prof_${counter++}`,
        name: profileName || `Measurement ${idx}`,
        created,
        measurements,
      });
    }
  }

  return result;
}

const GET_ORDERS_SINCE = `
  query GetOrdersSince($query: String!, $first: Int!, $after: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges { node { customer { id } } }
    }
  }
`;

async function fetchCustomerOrdersForSync(customerId) {
  const orders = [];
  let more = true,
    cur = null;
  while (more) {
    const data = await gql(GET_CUSTOMER_ORDERS_SYNC, {
      id: customerId,
      first: 50,
      after: cur,
    });
    const { edges, pageInfo } = data.customer.orders;
    orders.push(...edges.map((e) => e.node));
    more = pageInfo.hasNextPage;
    cur = pageInfo.endCursor;
  }
  return orders;
}

async function syncCustomerIds(customerIds) {
  let synced = 0,
    skipped = 0;
  for (const customerId of customerIds) {
    try {
      const orders = await fetchCustomerOrdersForSync(customerId);
      const profiles = buildProfilesFromOrders(orders);
      if (Object.keys(profiles).length === 0) {
        skipped++;
        continue;
      }
      await setCustomerProductsMetafield(customerId, profiles);
      console.log(`[sync-all] synced ${customerId}`);
      synced++;
    } catch (err) {
      console.error(`[sync-all] failed ${customerId}:`, err.message);
    }
  }
  return { synced, skipped };
}

export async function syncAllCustomerProfiles(since) {
  if (since) {
    // Incremental: find customers with orders created after `since`
    const customerIds = new Set();
    let hasNextPage = true,
      cursor = null;
    while (hasNextPage) {
      const data = await gql(GET_ORDERS_SINCE, {
        query: `created_at:>${since}`,
        first: 50,
        after: cursor,
      });
      const { edges, pageInfo } = data.orders;
      for (const { node } of edges) {
        if (node.customer?.id) customerIds.add(node.customer.id);
      }
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;
    }

    const ids = [...customerIds];
    console.log(
      `[sync-all] incremental: ${ids.length} customers with new orders since ${since}`,
    );
    if (ids.length === 0) return { synced: 0, skipped: 0, total: 0 };

    const { synced, skipped } = await syncCustomerIds(ids);
    return { synced, skipped, total: ids.length };
  }

  // Full sync: all customers with orders
  const customerIds = [];
  let hasNextPage = true,
    cursor = null;
  while (hasNextPage) {
    const data = await gql(GET_ALL_CUSTOMER_IDS, { first: 50, after: cursor });
    const { edges, pageInfo } = data.customers;
    for (const { node } of edges) {
      if (node.numberOfOrders > 0) customerIds.push(node.id);
    }
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  console.log(`[sync-all] full: ${customerIds.length} customers with orders`);
  const { synced, skipped } = await syncCustomerIds(customerIds);
  return { synced, skipped, total: customerIds.length };
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
      draftOrder {
        order { id name }
      }
      userErrors { field message }
    }
  }
`;

const UPDATE_ORDER = `
  mutation OrderUpdate($input: OrderInput!) {
    orderUpdate(input: $input) {
      order { id name note tags }
      userErrors { field message }
    }
  }
`;

export async function createDraftOrder(input) {
  const data = await gql(CREATE_DRAFT_ORDER, { input });
  const { draftOrder, userErrors } = data.draftOrderCreate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return draftOrder;
}

export async function completeDraftOrder(id, paymentPending = true) {
  const data = await gql(COMPLETE_DRAFT_ORDER, { id, paymentPending });
  const { draftOrder, userErrors } = data.draftOrderComplete;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return draftOrder.order;
}

const FIND_CUSTOMER_BY_EMAIL = `
  query FindCustomer($query: String!) {
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

export async function findCustomerByEmail(email) {
  const data = await gql(FIND_CUSTOMER_BY_EMAIL, { query: `email:${email}` });
  return data.customers?.edges?.[0]?.node ?? null;
}

export async function updateOrder(id, { note, tags }) {
  const input = { id };
  if (note !== undefined) input.note = note;
  if (tags !== undefined) input.tags = tags;
  const data = await gql(UPDATE_ORDER, { input });
  const { order, userErrors } = data.orderUpdate;
  if (userErrors?.length) throw new Error(userErrors[0].message);
  return order;
}
