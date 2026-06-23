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

// Garment → KT categoryId (from getSizeConflict API)
const _GARMENT_CATEGORY_IDS = {
  Jacket: 2,
  Trouser: 1001,
  Vest: 1002,
  Shirt: 1100,
};

// Garment → KT categoryCode (from KT supplier Excel, verified by PHP app)
const _GARMENT_CATEGORY_CODES = {
  Jacket: "MXF",
  Trouser: "MXK",
  Vest: "MMJ",
  Shirt: "MCY",
};

// Fit label (from "Jacket Fit" / "Trouser Fit" custom attr) → KT
// 1=Slim, 2=Regular/Classic (default), 3=Athletic/Loose
const _FIT_TO_VERSIONSTYLE = {
  Slim: 1,
  Classic: 2,
  Regular: 2,
  Athletic: 3,
  Loose: 3,
};

// Top-level `category` field based on garment combination (KT supplier Excel)
function _topLevelCategory(garments) {
  const has = (g) => garments.includes(g);
  if (has("Jacket") && has("Trouser") && has("Vest")) return "S"; // 3pc suit
  if (has("Jacket") && has("Trouser")) return "T"; // 2pc suit
  if (has("Jacket")) return "MXF";
  if (has("Trouser")) return "MXK";
  if (has("Vest")) return "MMJ";
  if (has("Shirt")) return "MCY";
  return "T";
}

const _STATIC_POSITION_ECODES = {
  Jacket: {
    neck: "1",
    chest: "2",
    stomach: "3",
    seat: "5",
    bicep: "8",
    shoulder: "11",
    sleevel: "13", // Sleeve(L)
    sleever: "14", // Sleeve(R)
    backlength: "15",
    napetowaist: "18",
    frontwaistlength: "19",
  },
  Trouser: {
    waist: "4",
    seat: "5",
    thigh: "6",
    urise: "7", // U-Rise / U-rise
    outseaml: "16", // Outseam(L)
    outseamr: "17", // Outseam(R)
    frontwaistheight: "20",
    backwaistheight: "21",
    knee: "23",
    bottom: "22",
  },
};

let _ktPositionMapCache = null;

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
      if (!part.name || part.ecode == null) continue;
      const norm = _normalizeKtName(part.name);
      catMap[norm] = String(part.ecode);
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

function _resolvePositionEcode(shopifyKey, ktPositionMap, garmentHint = null) {
  let garment = garmentHint;
  let label = shopifyKey;
  for (const g of Object.keys(_GARMENT_CATEGORY_IDS)) {
    if (shopifyKey.startsWith(g + " ")) {
      garment = g;
      label = shopifyKey.slice(g.length + 1);
      break;
    }
  }
  const normLabel = _normalizeKtName(label);
  if (garment) {
    const categoryId = _GARMENT_CATEGORY_IDS[garment];
    // 1. Dynamic KT map for this garment
    const dynHit = ktPositionMap[categoryId]?.[normLabel];
    if (dynHit) return dynHit;
    // 2. Static fallback for this garment
    const staticHit = _STATIC_POSITION_ECODES[garment]?.[normLabel];
    if (staticHit) return staticHit;
  }
  // 3. Search all dynamic categories
  for (const catMap of Object.values(ktPositionMap)) {
    if (catMap[normLabel]) return catMap[normLabel];
  }
  // 4. Search all static fallbacks
  for (const staticMap of Object.values(_STATIC_POSITION_ECODES)) {
    if (staticMap[normLabel]) return staticMap[normLabel];
  }
  return null;
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

function mapSizesForGarment(
  customAttributes = [],
  garment,
  ktPositionMap = {},
) {
  const seenEcodes = new Set();
  const result = [];
  for (const a of customAttributes) {
    if (a.key.startsWith("_") || !a.value || isNaN(parseFloat(a.value)))
      continue;
    // If key has a garment prefix that is NOT this garment, skip it
    let label = a.key;
    let belongsToOtherGarment = false;
    for (const g of Object.keys(_GARMENT_CATEGORY_IDS)) {
      if (a.key.startsWith(g + " ")) {
        if (g !== garment) {
          belongsToOtherGarment = true;
        } else {
          label = a.key.slice(g.length + 1);
        }
        break;
      }
    }
    if (belongsToOtherGarment) continue;
    const ecode = _resolvePositionEcode(label, ktPositionMap, garment);
    if (!ecode || seenEcodes.has(ecode)) continue;
    seenEcodes.add(ecode);
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

  // Customer suit_admin metafields as fallback for body measurements / unit
  const customerMeta = Object.fromEntries(
    (order.customer?.metafields?.edges ?? []).map((e) => [
      e.node.key,
      e.node.value,
    ]),
  );

  // Order suit_admin metafields — craft codes stored here for new orders
  const orderMeta = Object.fromEntries(
    (order.metafields?.edges ?? []).map((e) => [e.node.key, e.node.value]),
  );

  const height =
    parseFloat(kuteAttr(attrs, "height") ?? customerMeta.height ?? "71") || 71;
  const weight =
    parseFloat(kuteAttr(attrs, "weight") ?? customerMeta.weight ?? "180") ||
    180;
  const gender = parseInt(
    kuteAttr(attrs, "gender") ?? customerMeta.gender ?? "1002",
    10,
  );
  const heightUnit = parseInt(
    kuteAttr(attrs, "heightUnit") ?? customerMeta.height_unit ?? "1020",
    10,
  ); // 1019=cm, 1020=inch
  const weightUnit = parseInt(
    kuteAttr(attrs, "weightUnit") ?? customerMeta.weight_unit ?? "1018",
    10,
  ); // 1017=kg, 1018=lb
  const isSample = parseInt(kuteAttr(attrs, "isSample") ?? "0", 10);

  // Garments stored during order creation ("Jacket,Trouser" etc.)
  const garmentsRaw = kuteAttr(attrs, "garments") ?? "";
  const garments = garmentsRaw
    ? garmentsRaw
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : [];

  // Top-level category: derived from garment combination, not hardcoded
  const category = garments.length
    ? _topLevelCategory(garments)
    : (kuteAttr(attrs, "category") ?? "T");

  const rawNo =
    (order.name ?? "").replace(/^#/, "") || (order.id ?? "").split("/").pop();
  const customerNo = rawNo.padStart(8, "0");

  const orderDetails = lineItems.flatMap((item) => {
    const itemAttrs = item.customAttributes ?? [];
    const versionStyleRaw = kuteAttr(itemAttrs, "versionStyle");
    // versionStyle: 1=Slim, 2=Regular (default), 3=Loose (from KT supplier Excel)
    const versionStyle = versionStyleRaw ? parseInt(versionStyleRaw, 10) : 2;
    const sharedCrafts = kuteAttr(itemAttrs, "crafts") ?? "";
    const styleCode = kuteAttr(itemAttrs, "styleCode") ?? "";
    const sizeNames = kuteAttr(itemAttrs, "sizeNames") ?? "";

    if (garments.length > 0) {
      // One orderDetail per garment with garment-scoped measurements
      return garments.map((garment) => {
        // Per-garment versionStyle: read "Jacket Fit" / "Trouser Fit" attr
        const fitLabel =
          itemAttrs.find(
            (a) => a.key === `${garment} Fit` || a.key === `${garment} - Fit`,
          )?.value ?? null;
        const garmentVersionStyle = fitLabel
          ? (_FIT_TO_VERSIONSTYLE[fitLabel] ?? 2)
          : versionStyle;
        // Per-garment craft codes: order metafield (new orders) → line item attr (legacy) → shared crafts
        const crafts = _deduplicateCraftsByPid(
          orderMeta[`crafts_${garment.toLowerCase()}`] ??
            kuteAttr(itemAttrs, `crafts_${garment}`) ??
            sharedCrafts,
        );
        const orderSizes = mapSizesForGarment(
          itemAttrs,
          garment,
          ktPositionMap,
        );
        if (!orderSizes.length) {
          console.warn(
            `[KT] orderSizes EMPTY for garment "${garment}" — check customAttributes keys`,
          );
          const keys = itemAttrs
            .filter((a) => !a.key.startsWith("_"))
            .map((a) => a.key);
          console.warn(`[KT] available non-private attr keys:`, keys);
        } else {
          console.log(`[KT] orderSizes for "${garment}":`, orderSizes);
        }
        return {
          categoryCode: _GARMENT_CATEGORY_CODES[garment] ?? "MXF",
          styleCode,
          crafts,
          sizeNames,
          versionStyle: garmentVersionStyle,
          orderSizes,
          orderEmbs: [],
        };
      });
    }

    // Fallback: no garment info stored — one detail per line item
    return [
      {
        categoryCode: kuteAttr(itemAttrs, "categoryCode") ?? "MXF",
        styleCode,
        crafts,
        sizeNames,
        versionStyle,
        orderSizes: mapSizes(itemAttrs, ktPositionMap),
        orderEmbs: [],
      },
    ];
  });

  return {
    customerNo,
    submit,
    addProduct: lineItems.length > 1,
    amount: lineItems.reduce((s, i) => s + (i.quantity ?? 1), 0),
    isSample,
    category,
    measuresType: parseInt(
      kuteAttr(attrs, "measuresType") ?? customerMeta.measures_type ?? "10001",
      10,
    ), // 10001=body/net, 10002=finished, 10003=fitting
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
      heightUnit,
      weight,
      weightUnit,
    },
    orderDetails,
  };
}

// Returns the bare code from a craft entry that may have ":content" suffix
function _craftCode(entry) {
  return entry.split(":")[0].trim();
}

// Remove duplicate PIDs from a crafts string — keeps the last occurrence of each PID.
// Handles both plain ecodes ("000A") and PID:content entries ("0638:KB227").
function _deduplicateCraftsByPid(craftsStr) {
  if (!craftsStr) return craftsStr;
  const entries = craftsStr
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const byPid = new Map();
  for (const entry of entries) {
    byPid.set(_craftCode(entry), entry);
  }
  return [...byPid.values()].join(",");
}

// Resolve craft group conflicts across ALL orderDetails collectively.
// Handles two KT error formats:
//   [000B,00C1]            — "Each group of these craft can only choose one"
//   {302L} and {302E}      — "X{code1} and Y{code2} conflict exists"
function resolveConflictingCraftsAcrossDetails(details, errorMessage) {
  const groups = [];

  // Format 1: [code1,code2,...] — multiple codes in one bracket group
  for (const m of errorMessage.matchAll(/\[([^\]]+)\]/g)) {
    groups.push(
      m[1]
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    );
  }

  // Format 2: {code} ... {code} conflict exists — each brace is one conflicting code
  if (!groups.length && errorMessage.includes("conflict")) {
    const curly = [...errorMessage.matchAll(/\{([^}]+)\}/g)].map((m) =>
      m[1].trim(),
    );
    if (curly.length >= 2) groups.push(curly);
  }

  // Format 3: "Combination split code failed! Failed process code: Normal(AAAM), Full(AAQL),"
  if (
    !groups.length &&
    errorMessage.includes("Combination split code failed")
  ) {
    const paren = [...errorMessage.matchAll(/\(([^)]+)\)/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);
    if (paren.length >= 2) groups.push(paren);
  }

  if (!groups.length) return;

  for (const conflicting of groups) {
    let kept = null;
    for (const detail of details) {
      const ecodes = detail.crafts
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const present = conflicting.filter((c) =>
        ecodes.some((e) => _craftCode(e) === c),
      );
      if (!present.length) continue;
      if (!kept) kept = present[0];
      const toRemove = new Set(present.filter((c) => c !== kept));
      detail.crafts = ecodes
        .filter((e) => !toRemove.has(_craftCode(e)))
        .join(",");
    }
  }
}

function removeContentRequiredCraft(craftsStr, errorMessage) {
  const match = errorMessage.match(/craft<([^>]+)>/);
  if (!match) return craftsStr;
  const badEcode = match[1].trim();
  return craftsStr
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && _craftCode(e) !== badEcode)
    .join(",");
}

function removeUnavailableCrafts(craftsStr, errorMessage) {
  const badCodes = new Set();
  for (const m of errorMessage.matchAll(/\{([^}]+)\}/g)) {
    badCodes.add(m[1].trim());
  }
  if (!badCodes.size) return craftsStr;
  return craftsStr
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && !badCodes.has(_craftCode(e)))
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

  // Strip orderDetails with no measurements (e.g. upcharge line items)
  payload.orderDetails = payload.orderDetails.filter(
    (d) => d.orderSizes.length > 0,
  );

  // Inject default crafts when blank or stored in legacy [{pid,craftId}] JSON format
  for (const detail of payload.orderDetails) {
    const isLegacyJson = detail.crafts && detail.crafts.trim().startsWith("[");
    if (!detail.crafts || isLegacyJson) {
      const garment = Object.keys(_GARMENT_CATEGORY_CODES).find(
        (g) => _GARMENT_CATEGORY_CODES[g] === detail.categoryCode,
      );
      const categoryId = garment ? _GARMENT_CATEGORY_IDS[garment] : 2;
      detail.crafts = await fetchDefaultCraftsString(categoryId, token).catch(
        () => "",
      );
    }
  }

  console.log(
    "[KT] POST /order/saveOrder payload:",
    JSON.stringify(payload, null, 2),
  );

  let { res, rawText, body } = await postSaveOrder(token, payload);
  console.log("[KT] saveOrder response", res.status, rawText.slice(0, 500));

  // Unified craft retry loop — handles group conflicts and content-required errors
  // in any order they appear, up to 25 total iterations.
  let craftRetries = 0;
  while (typeof body.message === "string" && craftRetries++ < 25) {
    const msg = body.message;
    if (
      msg.includes("Each group of these craft can only choose one") ||
      (msg.includes("conflict") && /\{[^}]+\}/.test(msg))
    ) {
      console.log(
        "[KT] resolving craft group conflicts, attempt",
        craftRetries,
      );
      resolveConflictingCraftsAcrossDetails(payload.orderDetails, msg);
    } else if (msg.includes("please fill in the content specified by craft")) {
      console.log(
        "[KT] removing content-required craft, attempt",
        craftRetries,
      );
      for (const detail of payload.orderDetails) {
        detail.crafts = removeContentRequiredCraft(detail.crafts, msg);
      }
    } else if (msg.includes("do not have a specified process")) {
      console.log(
        "[KT] removing unavailable craft processes, attempt",
        craftRetries,
      );
      for (const detail of payload.orderDetails) {
        detail.crafts = removeUnavailableCrafts(detail.crafts, msg);
      }
    } else if (msg.includes("Combination split code failed")) {
      console.log(
        "[KT] resolving combination split conflict, attempt",
        craftRetries,
      );
      resolveConflictingCraftsAcrossDetails(payload.orderDetails, msg);
    } else if (msg.includes("duplicate craft ecode")) {
      console.log("[KT] deduplicating crafts by PID, attempt", craftRetries);
      let craftChanged = false;
      for (const detail of payload.orderDetails) {
        const deduped = _deduplicateCraftsByPid(detail.crafts);
        if (deduped !== detail.crafts) {
          detail.crafts = deduped;
          craftChanged = true;
        }
      }
      if (!craftChanged) break; // crafts already unique — different root cause, stop looping
    } else if (/craftEcode<\[/.test(msg)) {
      // Unknown craft ecodes (e.g. raw button/lining SKUs sent without PID prefix)
      const match = msg.match(/craftEcode<\[([^\]]+)\]>/);
      if (!match) break;
      const badCodes = new Set(
        match[1]
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      );
      console.log(
        "[KT] removing unknown craft ecodes",
        [...badCodes],
        "attempt",
        craftRetries,
      );
      for (const detail of payload.orderDetails) {
        detail.crafts = detail.crafts
          .split(",")
          .map((e) => e.trim())
          .filter((e) => e && !badCodes.has(_craftCode(e)))
          .join(",");
      }
    } else if (msg === "") {
      // KT returned empty message — transient server glitch. Retry once with unchanged payload.
      console.log("[KT] empty-message rejection, attempt", craftRetries);
      if (craftRetries >= 2) break;
    } else {
      break; // not a craft error — stop retrying
    }
    ({ res, rawText, body } = await postSaveOrder(token, payload));
    console.log(
      "[KT] craft retry",
      craftRetries,
      "response",
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
      msg == null || msg === ""
        ? `KuteTailor returned no error details (HTTP ${res.status}). The order may have an unsupported craft code — check browser console for the full payload.`
        : typeof msg === "object"
          ? JSON.stringify(msg)
          : String(msg);
    console.error("[KT] saveOrder error:", {
      status: res.status,
      body,
      rawText,
      payload,
    });
    throw new Error(msgStr);
  }
  return { payload, response: body };
}
