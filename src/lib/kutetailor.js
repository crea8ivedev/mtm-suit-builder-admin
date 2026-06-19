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

async function fetchDefaultCraftsString(categoryId, token) {
  const crafts = await fetchCraftsByCategory(categoryId, token);
  const seen = new Set();
  const ecodes = [];
  for (const c of crafts) {
    if (c.code && !seen.has(c.code)) {
      seen.add(c.code);
      ecodes.push(c.code);
    }
  }
  return ecodes.join(",");
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

// Garment prefix in Shopify attribute key → KT categoryId from getSizeConflict
const _GARMENT_CATEGORY_IDS = {
  Jacket: 2,
  Trouser: 1001,
  Vest: 1002,
  Shirt: 1100,
};

let _ktPositionMapCache = null; // set to null to force refetch after name→identifier fix

async function fetchKtPositionMap(token) {
  if (_ktPositionMapCache) return _ktPositionMapCache;
  const res = await ktFetch(
    "/customer/customer/size-conflict/getSizeConflict",
    token,
  );
  if (!Array.isArray(res.data)) return {};
  const map = {};
  for (const cat of res.data) {
    if (!cat.partVOSList?.length) continue;
    const catMap = {};
    for (const part of cat.partVOSList) {
      const norm = _normalizeKtName(part.name);
      catMap[norm] = part.name;
    }
    map[cat.categoryId] = catMap;
  }
  _ktPositionMapCache = map;
  return map;
}

function _normalizeKtName(name) {
  return (name ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function _resolvePositionEcode(shopifyKey, ktPositionMap) {
  let garment = null;
  let label = shopifyKey;
  for (const g of Object.keys(_GARMENT_CATEGORY_IDS)) {
    if (shopifyKey.startsWith(g + " ")) {
      garment = g;
      label = shopifyKey.slice(g.length + 1);
      break;
    }
  }
  const categoryId = garment ? _GARMENT_CATEGORY_IDS[garment] : null;
  if (!categoryId || !ktPositionMap[categoryId]) return null;
  return ktPositionMap[categoryId][_normalizeKtName(label)] ?? null;
}

function mapSizes(customAttributes = [], ktPositionMap = {}) {
  const result = [];
  for (const a of customAttributes) {
    if (a.key.startsWith("_") || !a.value || isNaN(parseFloat(a.value)))
      continue;
    const ecode = _resolvePositionEcode(a.key, ktPositionMap);
    if (!ecode) continue;
    result.push({ positionEcode: ecode, size: parseFloat(a.value) });
  }
  return result;
}

function kuteAttr(customAttributes = [], key) {
  return customAttributes.find((a) => a.key === `_kute_${key}`)?.value ?? null;
}

function buildOrderPayload(order, { submit, ktPositionMap = {} }) {
  const attrs = order.customAttributes ?? [];
  const firstName = order.customer?.firstName ?? "";
  const lastName = order.customer?.lastName ?? "";
  const lineItems = order.lineItems?.edges?.map((e) => e.node) ?? [];

  const height = parseFloat(kuteAttr(attrs, "height") ?? "0") || 0;
  const weight = parseFloat(kuteAttr(attrs, "weight") ?? "0") || 0;
  const gender = parseInt(kuteAttr(attrs, "gender") ?? "1004", 10);

  const rawNo =
    (order.name ?? "").replace(/^#/, "") || (order.id ?? "").split("/").pop();
  const customerNo = rawNo.padStart(8, "0");

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
      const versionStyleRaw = kuteAttr(itemAttrs, "versionStyle");
      return {
        categoryCode: kuteAttr(itemAttrs, "categoryCode") ?? "MXF",
        styleCode: kuteAttr(itemAttrs, "styleCode") ?? "",
        crafts: kuteAttr(itemAttrs, "crafts") ?? "",
        sizeNames: kuteAttr(itemAttrs, "sizeNames") ?? "",
        versionStyle: versionStyleRaw ? parseInt(versionStyleRaw, 10) : 10,
        orderSizes: mapSizes(itemAttrs, ktPositionMap),
        orderEmbs: [],
      };
    }),
  };
}

function resolveConflictingCrafts(craftsStr, errorMessage) {
  const groupMatches = [...errorMessage.matchAll(/\[([^\]]+)\]/g)];
  if (!groupMatches.length) return { crafts: craftsStr, fallbacks: {} };
  let ecodes = craftsStr
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const fallbacks = {};
  for (const m of groupMatches) {
    const conflicting = m[1].split(",").map((c) => c.trim());
    const present = conflicting.filter((c) => ecodes.includes(c));
    if (present.length <= 1) continue;
    const [keep, ...rest] = present;
    fallbacks[keep] = rest;
    const restSet = new Set(rest);
    ecodes = ecodes.filter((e) => !restSet.has(e));
  }
  return { crafts: ecodes.join(","), fallbacks };
}

function removeContentRequiredCraft(craftsStr, errorMessage) {
  const match = errorMessage.match(/craft<([^>]+)>/);
  if (!match) return craftsStr;
  const badEcode = match[1].trim();
  return craftsStr
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e !== badEcode)
    .join(",");
}

async function postSaveOrder(token, payload) {
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
  let body = {};
  try {
    body = JSON.parse(rawText);
  } catch {}
  return { res, rawText, body };
}

export async function sendToKutetailor(order, { submit = true } = {}) {
  const token = await getToken();
  const ktPositionMap = await fetchKtPositionMap(token).catch(() => ({}));
  const payload = buildOrderPayload(order, { submit, ktPositionMap });

  if (!payload.fabric) {
    throw new Error(
      "Fabric is required. Please select a fabric for this order before submitting to KuteTailor.",
    );
  }

  // Inject default crafts when blank or stored in legacy [{pid,craftId}] JSON format
  for (const detail of payload.orderDetails) {
    const isLegacyJson = detail.crafts && detail.crafts.trim().startsWith("[");
    if (!detail.crafts || isLegacyJson) {
      const categoryId = detail._categoryId ?? 2;
      detail.crafts = await fetchDefaultCraftsString(categoryId, token).catch(
        () => "",
      );
    }
    delete detail._categoryId;
  }

  console.log(
    "[KT] POST /order/saveOrder payload:",
    JSON.stringify(payload, null, 2),
  );

  let { res, rawText, body } = await postSaveOrder(token, payload);
  console.log("[KT] saveOrder response", res.status, rawText.slice(0, 500));

  // Retry A: resolve mutually exclusive craft group conflicts
  if (
    typeof body.message === "string" &&
    body.message.includes("Each group of these craft can only choose one")
  ) {
    console.log("[KT] resolving craft group conflicts, retrying...");
    for (const detail of payload.orderDetails) {
      const { crafts } = resolveConflictingCrafts(detail.crafts, body.message);
      detail.crafts = crafts;
    }
    ({ res, rawText, body } = await postSaveOrder(token, payload));
    console.log("[KT] retry A response", res.status, rawText.slice(0, 500));
  }

  // Retry B+: loop — remove each craft requiring content until none left (max 15 iterations)
  let contentRetries = 0;
  while (
    typeof body.message === "string" &&
    body.message.includes("please fill in the content specified by craft") &&
    contentRetries++ < 15
  ) {
    console.log(
      "[KT] removing content-required craft, retrying...",
      contentRetries,
    );
    for (const detail of payload.orderDetails) {
      detail.crafts = removeContentRequiredCraft(detail.crafts, body.message);
    }
    ({ res, rawText, body } = await postSaveOrder(token, payload));
    console.log(
      "[KT] retry B" + contentRetries + " response",
      res.status,
      rawText.slice(0, 500),
    );
  }

  if (
    typeof body.message === "string" &&
    body.message.includes("duplicate customer no")
  ) {
    return { payload, response: body, alreadySubmitted: true };
  }

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
