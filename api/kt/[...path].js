export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // req.query.path = ['token','oauth','token'] for /api/kt/token/oauth/token
  const segments = req.query.path;
  const pathPart = Array.isArray(segments) ? "/" + segments.join("/") : "/";

  // Preserve query string but strip the Vercel routing param
  const qs = req.url.includes("?") ? "?" + req.url.split("?").slice(1).join("?") : "";

  const base = (
    process.env.VITE_KUTETAILOR_API_URL ?? "https://platform.kutetailor.com/api"
  ).replace(/\/$/, "");

  const url = `${base}${pathPart}${qs}`;

  const body = await readBody(req);

  const headers = {};
  for (const h of ["content-type", "authorization", "accept", "accept-language"]) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }

  const r = await fetch(url, {
    method: req.method,
    headers,
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
