import { config } from "../config.js";

const BASE = config.kutetailor.apiUrl;

let _token = null;
let _tokenExpiry = 0;

async function fetchFreshToken() {
  const form = new URLSearchParams({
    grant_type: "password",
    client_id: config.kutetailor.clientId,
    client_secret: config.kutetailor.clientSecret,
    username: config.kutetailor.username,
    password: config.kutetailor.password,
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
  try { json = JSON.parse(raw); } catch { /* non-JSON */ }

  if (!res.ok || (json.code !== undefined && json.code !== "0")) {
    throw new Error(json.message || json.error || `Kutetailor login failed: HTTP ${res.status}`);
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

  if (!accessToken) {
    throw new Error(`No access_token in response: ${raw.slice(0, 200)}`);
  }

  _token = accessToken;
  _tokenExpiry = Date.now() + (expiresIn - 300) * 1000;
  return _token;
}

export async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  return fetchFreshToken();
}

function mapSizes(customAttributes = []) {
  return customAttributes
    .filter(
      (a) => !a.key.startsWith("_") && a.value && !isNaN(parseFloat(a.value)),
    )
    .map((a) => ({
      positionEcode: a.key,
      size: parseFloat(a.value),
    }));
}

function kuteAttr(customAttributes = [], key) {
  return customAttributes.find((a) => a.key === `_kute_${key}`)?.value ?? null;
}

function buildPayload(order, { submit }) {
  const attrs = order.customAttributes ?? []; // order-level attributes
  const firstName = order.customer?.firstName ?? "";
  const lastName = order.customer?.lastName ?? "";
  const lineItems = order.lineItems?.edges?.map((e) => e.node) ?? [];

  const height = parseFloat(kuteAttr(attrs, "height") ?? "0") || 0;
  const weight = parseFloat(kuteAttr(attrs, "weight") ?? "0") || 0;
  const gender = parseInt(kuteAttr(attrs, "gender") ?? "1004", 10); // 1004=unknown

  return {
    customerNo: order.name, // Shopify order name e.g. "#1001"
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
      heightUnit: 1019, // cm
      weight,
      weightUnit: 1017, // kg
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

export async function testAuth() {
  const token = await getToken();
  return { ok: true, tokenPreview: token.slice(0, 30) + "..." };
}

export async function sendToKutetailor(order, { submit = true } = {}) {
  const token = await getToken();
  const payload = buildPayload(order, { submit });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.kutetailor.timeout);

  try {
    const res = await fetch(`${BASE}/order/saveOrder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": "en_US",
        Authorization: `bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok || body.code === "1") {
      const msg = body?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return { payload, response: body };
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out (30s)");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
