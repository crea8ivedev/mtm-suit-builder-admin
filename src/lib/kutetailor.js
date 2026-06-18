const BASE = "/api/kt";

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
  } catch {}

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
    if (item.memberId == 0 && !(pid in systemDefaults)) {
      systemDefaults[pid] = { craftId: item.craftId, sort: item.sort ?? 999 };
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

  const customerNo =
    (order.id ?? "").split("/").pop() || order.name.replace(/\D/g, "");

  return {
    customerNo,
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

  console.log("[KT] POST /order/saveOrder payload:", JSON.stringify(payload, null, 2));

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

  const rawText = await res.text().catch(() => "");
  console.log("[KT] saveOrder response", res.status, rawText.slice(0, 500));

  let body = {};
  try { body = JSON.parse(rawText); } catch {}

  if (!res.ok || body.code === "1" || body.code === 1) {
    const msg = body?.message ?? body?.msg ?? body?.error ?? body?.data ?? null;
    const msgStr =
      msg == null
        ? `HTTP ${res.status}${rawText ? `: ${rawText.slice(0, 300)}` : ""}`
        : typeof msg === "object"
        ? JSON.stringify(msg)
        : String(msg);
    throw new Error(msgStr);
  }
  return { payload, response: body };
}
