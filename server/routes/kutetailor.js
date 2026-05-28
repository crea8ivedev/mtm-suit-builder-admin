import { Router } from "express";
import { config } from "../config.js";
import { getToken } from "../services/kutetailor.js";

const BASE = config.kutetailor.apiUrl;
const router = Router();

// All known jacket fabric codes (DEE prefix = Jacket category)
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

// In-memory caches
let _jacketCache = null;
let _jacketCacheAt = 0;
const CACHE_TTL = 10 * 60 * 1000;

let _craftsCache = null;
let _craftsCacheAt = 0;
const CRAFTS_CACHE_TTL = 30 * 60 * 1000; // 30 min — craft data rarely changes

// MXF = Men's Jacket, categoryId=2 in Kuttailor
const MXF_CATEGORY_ID = 2;

async function fetchJacketCrafts(token) {
  // Craft endpoints live at /api/craft/craft/{path} (gateway routes /craft → craft service)
  const CRAFT_BASE = "/craft/craft";

  // Step 1: get defaults for MXF
  const defaultsResp = await ktFetch(
    `${CRAFT_BASE}/craft-default/selectByCategoryId?categoryId=${MXF_CATEGORY_ID}`,
    token,
  );
  const defaults = Array.isArray(defaultsResp.data) ? defaultsResp.data : [];

  // Filter to no-lapel defaults, deduplicate by pid, keep sort order
  const pidToEntry = {};
  for (const item of defaults) {
    if (item.lapel === null && !(item.pid in pidToEntry)) {
      pidToEntry[item.pid] = { craftId: item.craftId, sort: item.sort ?? 999 };
    }
  }

  const pids = Object.keys(pidToEntry).map(Number);
  const craftIds = [
    ...new Set(Object.values(pidToEntry).map((v) => v.craftId)),
  ];

  // Step 2: resolve category names + craft details in parallel
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

  // Build sorted result
  const crafts = pids
    .filter((pid) => catMap[pid] && craftMap[pidToEntry[pid].craftId])
    .map((pid) => ({
      category: catMap[pid],
      name: craftMap[pidToEntry[pid].craftId].name,
      code: craftMap[pidToEntry[pid].craftId].code,
      sort: pidToEntry[pid].sort,
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ category, name, code }) => ({ category, name, code }));

  return crafts;
}

// GET /api/kutetailor/test-auth
router.get("/test-auth", async (_req, res) => {
  try {
    const token = await getToken();
    return res.json({
      success: true,
      tokenPreview: token.slice(0, 30) + "...",
    });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/kutetailor/jackets
// Returns all jacket fabrics. Cached 10 min.
router.get("/jackets", async (_req, res) => {
  try {
    if (_jacketCache && Date.now() - _jacketCacheAt < CACHE_TTL) {
      return res.json({ success: true, data: _jacketCache, cached: true });
    }

    const token = await getToken();
    const fabrics = await fetchFabricBatch(JACKET_CODES, token);

    _jacketCache = fabrics;
    _jacketCacheAt = Date.now();

    console.log(`[kutetailor] fetched ${fabrics.length} jacket fabrics`);
    return res.json({ success: true, data: fabrics, cached: false });
  } catch (err) {
    console.error("[kutetailor] /jackets error:", err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/kutetailor/crafts
// Returns default customization attributes for Men's Jacket (MXF). Cached 30 min.
router.get("/crafts", async (_req, res) => {
  try {
    if (_craftsCache && Date.now() - _craftsCacheAt < CRAFTS_CACHE_TTL) {
      return res.json({ success: true, data: _craftsCache, cached: true });
    }
    const token = await getToken();
    const crafts = await fetchJacketCrafts(token);
    _craftsCache = crafts;
    _craftsCacheAt = Date.now();
    console.log(
      `[kutetailor] fetched ${crafts.length} jacket craft attributes`,
    );
    return res.json({ success: true, data: crafts, cached: false });
  } catch (err) {
    console.error("[kutetailor] /crafts error:", err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// GET /api/kutetailor/fabric?fabricCode=xxx
router.get("/fabric", async (req, res) => {
  const { fabricCode } = req.query;
  if (!fabricCode)
    return res.status(400).json({ error: "fabricCode is required" });
  try {
    const token = await getToken();
    const json = await ktFetch(
      `/fabric/fabric/queryFabric?fabricCode=${encodeURIComponent(fabricCode)}`,
      token,
    );
    if (json.code === "1")
      return res
        .status(502)
        .json({ error: json.message || "Kutetailor error" });
    return res.json(json);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// GET /api/kutetailor/stock/:fabricCode
router.get("/stock/:fabricCode", async (req, res) => {
  const { fabricCode } = req.params;
  try {
    const token = await getToken();
    const json = await ktFetch(
      `/order/stock/${encodeURIComponent(fabricCode)}`,
      token,
    );
    if (json.code === "1")
      return res
        .status(502)
        .json({ error: json.message || "Kutetailor error" });
    return res.json(json);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

export default router;
