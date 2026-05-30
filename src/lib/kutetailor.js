const BASE = "/api/kt"; // proxied to VITE_KUTETAILOR_API_URL in vite.config.js / vercel api/kt.js

let _token = null;
let _tokenExpiry = 0;

async function fetchFreshToken() {
  const form = new URLSearchParams({
    grant_type: "password",
    client_id: import.meta.env.VITE_KUTETAILOR_CLIENT_ID ?? "",
    client_secret: import.meta.env.VITE_KUTETAILOR_CLIENT_SECRET ?? "",
    username: import.meta.env.VITE_KUTETAILOR_USERNAME ?? "",
    password: import.meta.env.VITE_KUTETAILOR_PASSWORD ?? "",
  });

  const res = await fetch(`${BASE}/token/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const raw = await res.text().catch(() => "");
  let json = {};
  try {
    json = JSON.parse(raw);
  } catch {
    /* non-JSON */
  }

  if (!res.ok || (json.code !== undefined && json.code !== "0")) {
    throw new Error(
      json.message ||
        json.error ||
        `KuteTailor login failed: HTTP ${res.status}`,
    );
  }

  let accessToken, expiresIn;
  if (json.data && typeof json.data === "object") {
    accessToken = json.data.access_token;
    expiresIn = json.data.expires_in ?? 7200;
  } else if (json.data && typeof json.data === "string") {
    accessToken = json.data;
    expiresIn = 7200;
  } else if (json.access_token) {
    accessToken = json.access_token;
    expiresIn = json.expires_in ?? 7200;
  }

  if (!accessToken)
    throw new Error(`No access_token in response: ${raw.slice(0, 200)}`);

  _token = accessToken;
  _tokenExpiry = Date.now() + (expiresIn - 300) * 1000;
  return _token;
}

export async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  return fetchFreshToken();
}

async function ktFetch(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      Authorization: `bearer ${token}`,
    },
  });
  return res.json().catch(() => ({}));
}

async function ktPost(path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": "en_US",
      Authorization: `bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

function decodeUserId(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return payload.user_id ?? payload.userId ?? null;
  } catch {
    return null;
  }
}

async function fetchFabricBatch(codes, token) {
  const results = [];
  const BATCH = 10;
  for (let i = 0; i < codes.length; i += BATCH) {
    const slice = codes.slice(i, i + BATCH);
    const items = await Promise.all(
      slice.map((code) =>
        ktFetch(`/fabric/fabric/queryFabric?fabricCode=${code}`, token)
          .then((j) =>
            Array.isArray(j.data) && j.data.length ? j.data[0] : null,
          )
          .catch(() => null),
      ),
    );
    results.push(...items.filter(Boolean));
  }
  return results;
}

const JACKET_CODES = [
  "DEE1001",
  "DEE1002",
  "DEE1003",
  "DEE1004",
  "DEE1005",
  "DEE1007",
  "DEE1008",
  "DEE1009",
  "DEE1010",
  "DEE1011",
  "DEE1012",
  "DEE1013",
  "DEE1014",
  "DEE1015",
  "DEE1016",
  "DEE1017",
  "DEE1018",
  "DEE1019",
  "DEE1020",
  "DEE1021",
  "DEE1022",
  "DEE1023",
  "DEE1024",
  "DEE1025",
  "DEE2001",
  "DEE2002",
  "DEE2003",
  "DEE2004",
  "DEE2005",
  "DEE2006",
  "DEE2007",
  "DEE2008",
  "DEE2009",
  "DEE2010",
  "DEE2011",
  "DEE2012",
  "DEE2013",
  "DEE2014",
  "DEE2015",
  "DEE2016",
  "DEE2017",
  "DEE2018",
  "DEE2019",
  "DEE2020",
  "DEE2021",
  "DEE2022",
  "DEE2023",
  "DEE2024",
  "DEE2025",
  "DEE2026",
  "DEE2027",
  "DEE2028",
  "DEE2029",
  "DEE2030",
  "DEE2031",
  "DEE2032",
  "DEE2034",
  "DEE2035",
  "DEE2036",
  "DEE2037",
];

let _jacketCache = null;
let _jacketCacheAt = 0;
const CACHE_TTL = 10 * 60 * 1000;

export async function fetchJackets() {
  if (_jacketCache && Date.now() - _jacketCacheAt < CACHE_TTL)
    return _jacketCache;
  const token = await getToken();
  const fabrics = await fetchFabricBatch(JACKET_CODES, token);
  _jacketCache = fabrics;
  _jacketCacheAt = Date.now();
  return fabrics;
}

const CRAFTS_CACHE_TTL = 30 * 60 * 1000;
const _craftsCache = {};
const _craftsCacheAt = {};

async function fetchCraftsByCategory(categoryId, token) {
  const CRAFT_BASE = "/craft/craft";
  const userId = decodeUserId(token);

  const defaultsResp = await ktFetch(
    `${CRAFT_BASE}/craft-default/selectByCategoryId?categoryId=${categoryId}`,
    token,
  );
  const defaults = Array.isArray(defaultsResp.data) ? defaultsResp.data : [];

  const systemDefaults = {};
  const memberOverrides = {};

  for (const item of defaults) {
    if (item.lapel !== null) continue;
    const pid = item.pid;
    // eslint-disable-next-line eqeqeq
    if (item.memberId == 0 && !(pid in systemDefaults)) {
      systemDefaults[pid] = { craftId: item.craftId, sort: item.sort ?? 999 };
      // eslint-disable-next-line eqeqeq
    } else if (userId && item.memberId == userId) {
      memberOverrides[pid] = { craftId: item.craftId, sort: item.sort ?? 999 };
    }
  }

  const pidToEntry = { ...systemDefaults };
  for (const [pid, entry] of Object.entries(memberOverrides)) {
    if (pid in systemDefaults) pidToEntry[pid] = entry;
  }

  const pids = Object.keys(pidToEntry).map(Number);
  const craftIds = [
    ...new Set(Object.values(pidToEntry).map((v) => v.craftId)),
  ];

  const [catResp, craftResp] = await Promise.all([
    ktPost(`${CRAFT_BASE}/craft/listCraftByIdList`, token, pids),
    ktPost(`${CRAFT_BASE}/craft/listCraftByIdList`, token, craftIds),
  ]);

  const catMap = Object.fromEntries(
    (catResp.data || []).map((c) => [c.id, c.en || c.name]),
  );
  const craftMap = Object.fromEntries(
    (craftResp.data || []).map((c) => [
      c.id,
      { name: c.en || c.name, code: c.ecode || null },
    ]),
  );

  return pids
    .filter((pid) => catMap[pid] && craftMap[pidToEntry[pid].craftId])
    .map((pid) => ({
      pid,
      craftId: pidToEntry[pid].craftId,
      categoryId,
      category: catMap[pid],
      name: craftMap[pidToEntry[pid].craftId].name,
      code: craftMap[pidToEntry[pid].craftId].code,
      sort: pidToEntry[pid].sort,
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ category, name, code, pid, craftId, categoryId: cid }) => ({
      pid,
      craftId,
      categoryId: cid,
      category,
      name,
      code,
    }));
}

export async function getCrafts(categoryId) {
  if (
    _craftsCache[categoryId] &&
    Date.now() - _craftsCacheAt[categoryId] < CRAFTS_CACHE_TTL
  ) {
    return _craftsCache[categoryId];
  }
  const token = await getToken();
  const crafts = await fetchCraftsByCategory(categoryId, token);
  _craftsCache[categoryId] = crafts;
  _craftsCacheAt[categoryId] = Date.now();
  return crafts;
}

export async function getCraftOptions(pid, categoryId = 2) {
  const token = await getToken();
  const CRAFT_BASE = "/craft/craft";
  const defaultsResp = await ktFetch(
    `${CRAFT_BASE}/craft-default/selectByCategoryId?categoryId=${categoryId}`,
    token,
  );
  const defaults = Array.isArray(defaultsResp.data) ? defaultsResp.data : [];
  const craftIdCount = {};
  for (const item of defaults) {
    if (item.pid === pid && item.lapel === null) {
      craftIdCount[item.craftId] = (craftIdCount[item.craftId] || 0) + 1;
    }
  }
  if (Object.keys(craftIdCount).length === 0) return [];

  const filteredIds = Object.entries(craftIdCount)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => Number(id));

  const userId = decodeUserId(token);
  for (const item of defaults) {
    if (item.pid === pid && item.lapel === null) {
      // eslint-disable-next-line eqeqeq
      if (
        (item.memberId == 0 || (userId && item.memberId == userId)) &&
        !filteredIds.includes(item.craftId)
      ) {
        filteredIds.push(item.craftId);
      }
    }
  }

  const craftResp = await ktPost(
    `${CRAFT_BASE}/craft/listCraftByIdList`,
    token,
    filteredIds,
  );
  const filteredIdSet = new Set(filteredIds);
  const seenIds = new Set();
  const seenNames = new Set();
  const options = [];
  for (const c of craftResp.data || []) {
    const name = c.en || c.name;
    if (filteredIdSet.has(c.id) && !seenIds.has(c.id) && !seenNames.has(name)) {
      seenIds.add(c.id);
      seenNames.add(name);
      const imgUrl = c.ecode
        ? `https://aws-static-webp.kutetailor.com/comm/process/craft/${c.ecode}.jpeg`
        : null;
      options.push({ id: c.id, name, code: c.ecode || null, imgUrl });
    }
  }
  return options;
}

const SYNC_CATS = [
  { label: "Men Jacket", categoryId: 2 },
  { label: "Men Pants", categoryId: 1001 },
  { label: "Men Vest", categoryId: 1002 },
  { label: "Men Shirt", categoryId: 1100 },
  { label: "Men Tuxedo", categoryId: 2853 },
];

const CDN = "https://aws-static-webp.kutetailor.com/comm/process/craft";
const CRAFT_BASE = "/craft/craft";

export async function buildSyncPayload() {
  const token = await getToken();
  const result = {};

  for (const cat of SYNC_CATS) {
    const defaultsResp = await ktFetch(
      `${CRAFT_BASE}/craft-default/selectByCategoryId?categoryId=${cat.categoryId}`,
      token,
    );
    const defaults = Array.isArray(defaultsResp.data) ? defaultsResp.data : [];
    const crafts = await fetchCraftsByCategory(cat.categoryId, token);
    const categoryData = {};

    const allCraftIds = [
      ...new Set(
        defaults.filter((i) => i.lapel === null).map((i) => i.craftId),
      ),
    ];
    const craftResp = await ktPost(
      `${CRAFT_BASE}/craft/listCraftByIdList`,
      token,
      allCraftIds,
    );
    const craftMap = Object.fromEntries(
      (craftResp.data || []).map((c) => [c.id, c]),
    );

    for (const craft of crafts) {
      const pidCraftIds = [
        ...new Set(
          defaults
            .filter((i) => i.pid === craft.pid && i.lapel === null)
            .map((i) => i.craftId),
        ),
      ];
      const seenNames = new Set();
      const options = [];
      for (const id of pidCraftIds) {
        const c = craftMap[id];
        if (!c) continue;
        const name = c.en || c.name;
        if (seenNames.has(name)) continue;
        seenNames.add(name);
        options.push({
          id: c.id,
          name,
          code: c.ecode || null,
          imgUrl: c.ecode ? `${CDN}/${c.ecode}.jpeg` : null,
        });
      }
      categoryData[craft.category] = {
        pid: craft.pid,
        defaultCode: craft.code,
        defaultName: craft.name,
        options,
      };
    }
    result[cat.label] = categoryData;
  }
  return result;
}

function mapSizes(customAttributes = []) {
  return customAttributes
    .filter(
      (a) => !a.key.startsWith("_") && a.value && !isNaN(parseFloat(a.value)),
    )
    .map((a) => ({ positionEcode: a.key, size: parseFloat(a.value) }));
}

function kuteAttr(customAttributes = [], key) {
  return customAttributes.find((a) => a.key === `_kute_${key}`)?.value ?? null;
}

function buildOrderPayload(order, { submit }) {
  const attrs = order.customAttributes ?? [];
  const firstName = order.customer?.firstName ?? "";
  const lastName = order.customer?.lastName ?? "";
  const lineItems = order.lineItems?.edges?.map((e) => e.node) ?? [];

  const height = parseFloat(kuteAttr(attrs, "height") ?? "0") || 0;
  const weight = parseFloat(kuteAttr(attrs, "weight") ?? "0") || 0;
  const gender = parseInt(kuteAttr(attrs, "gender") ?? "1004", 10);

  return {
    customerNo: order.name,
    submit,
    addProduct: lineItems.length > 1,
    amount: lineItems.reduce((s, i) => s + (i.quantity ?? 1), 0),
    isSample: 0,
    category: kuteAttr(attrs, "category") ?? "T",
    measuresType: parseInt(kuteAttr(attrs, "measuresType") ?? "10001", 10),
    fabric: kuteAttr(attrs, "fabric") ?? "",
    customer: {
      nickname:
        `${firstName} ${lastName}`.trim() || (order.customer?.email ?? "Guest"),
      firstname: firstName,
      lastname: lastName,
      gender,
      phone: order.customer?.phone ?? "",
      email: order.customer?.email ?? "",
      address: order.shippingAddress?.address1 ?? "",
      height,
      heightUnit: 1019,
      weight,
      weightUnit: 1017,
    },
    orderDetails: lineItems.map((item) => {
      const itemAttrs = item.customAttributes ?? [];
      return {
        categoryCode: kuteAttr(itemAttrs, "categoryCode") ?? "MXF",
        styleCode: kuteAttr(itemAttrs, "styleCode") ?? "",
        crafts: kuteAttr(itemAttrs, "crafts") ?? "",
        sizeNames: kuteAttr(itemAttrs, "sizeNames") ?? "",
        orderSizes: mapSizes(itemAttrs),
        orderEmbs: [],
      };
    }),
  };
}

export async function sendToKutetailor(order, { submit = true } = {}) {
  const token = await getToken();
  const payload = buildOrderPayload(order, { submit });

  const res = await fetch(`${BASE}/order/saveOrder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": "en_US",
      Authorization: `bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code === "1") {
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return { payload, response: body };
}
