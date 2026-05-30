export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/shopify/, "") || "/graphql.json";
  const url = `${process.env.VITE_SHOPIFY_STORE_DOMAIN}/admin/api/2025-01${path}`;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const r = await fetch(url, {
    method: req.method,
    headers: {
      "Content-Type": req.headers["content-type"] || "application/json",
      "X-Shopify-Access-Token": process.env.VITE_SHOPIFY_ACCESS_TOKEN,
    },
    body,
  });

  const text = await r.text();
  res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
  res.status(r.status).send(text);
}
