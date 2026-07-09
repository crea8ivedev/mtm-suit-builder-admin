export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const pathPart = req.query.path ? "/" + req.query.path : "/graphql.json";

  const rest = { ...req.query };
  delete rest.path;
  const qs = Object.keys(rest).length ? "?" + new URLSearchParams(rest).toString() : "";

  const url = `${process.env.VITE_SHOPIFY_STORE_DOMAIN}/admin/api/2025-01${pathPart}${qs}`;

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
