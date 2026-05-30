export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // req.query.path = ['graphql.json'] for /api/shopify/graphql.json
  const segments = req.query.path;
  const pathPart = Array.isArray(segments) ? "/" + segments.join("/") : "/graphql.json";

  // Preserve any query string (e.g. ?fields=...)
  const qs = req.url.includes("?") ? "?" + req.url.split("?").slice(1).join("?") : "";

  const url =
    `${process.env.VITE_SHOPIFY_STORE_DOMAIN}/admin/api/2025-01${pathPart}${qs}`;

  const body = await readBody(req);

  const r = await fetch(url, {
    method: req.method,
    headers: {
      "Content-Type": req.headers["content-type"] || "application/json",
      "X-Shopify-Access-Token": process.env.VITE_SHOPIFY_ACCESS_TOKEN,
    },
    body: hasBody(req.method) ? body : undefined,
  });

  const text = await r.text();
  res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
  res.status(r.status).send(text);
}

function hasBody(method) {
  return method !== "GET" && method !== "HEAD";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on("error", reject);
  });
}
