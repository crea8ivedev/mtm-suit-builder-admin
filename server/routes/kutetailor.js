import { Router } from "express";
import { config } from "../config.js";
import { getToken } from "../services/kutetailor.js";
import { setShopMetafield } from "../services/shopify.js";

const BASE = config.kutetailor.apiUrl;
const router = Router();

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

let _jacketCache = null;
let _jacketCacheAt = 0;
const CACHE_TTL = 10 * 60 * 1000;

const CRAFTS_CACHE_TTL = 30 * 60 * 1000; // 30 min
const _craftsCache = {}; // keyed by categoryId
const _craftsCacheAt = {};

function decodeUserId(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    return payload.user_id ?? payload.userId ?? null;
  } catch {
    return null;
  }
}

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
    if (pid in systemDefaults) {
      pidToEntry[pid] = entry;
    }
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

  const crafts = pids
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
    .map(({ category, name, code, pid, craftId, categoryId: cid }) => ({ pid, craftId, categoryId: cid, category, name, code }));

  return crafts;
}

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

router.get("/jackets", async (_req, res) => {
  try {
    if (_jacketCache && Date.now() - _jacketCacheAt < CACHE_TTL) {
      return res.json({ success: true, data: _jacketCache, cached: true });
    }

    const token = await getToken();
    const fabrics = await fetchFabricBatch(JACKET_CODES, token);

    _jacketCache = fabrics;
    _jacketCacheAt = Date.now();

    return res.json({ success: true, data: fabrics, cached: false });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/craft-options-bulk", async (req, res) => {
  const categoryId = Number(req.query.categoryId ?? 2);
  try {
    const token = await getToken();
    const resp = await ktFetch(`/craft/craft/craft-default/selectByCategoryId?categoryId=${categoryId}`, token);
    const all = Array.isArray(resp.data) ? resp.data : [];

    const pidMap = {};
    for (const item of all) {
      if (!pidMap[item.pid]) pidMap[item.pid] = new Set();
      pidMap[item.pid].add(item.craftId);
    }

    const allCraftIds = [...new Set(all.map(i => i.craftId))];
    const nameResp = await ktPost(`/craft/craft/craft/listCraftByIdList`, token, allCraftIds);
    const nameMap = Object.fromEntries((nameResp.data || []).map(c => [c.id, { name: c.en || c.name, code: c.ecode }]));

    const pidIds = Object.keys(pidMap).map(Number);
    const pidNameResp = await ktPost(`/craft/craft/craft/listCraftByIdList`, token, pidIds);
    const pidNameMap = Object.fromEntries((pidNameResp.data || []).map(c => [c.id, c.en || c.name]));

    const result = pidIds.map(pid => ({
      pid,
      pidName: pidNameMap[pid] ?? `pid:${pid}`,
      optionCount: pidMap[pid].size,
      options: [...pidMap[pid]].map(id => ({ id, name: nameMap[id]?.name ?? "?", code: nameMap[id]?.code ?? null })),
    }));

    return res.json({ categoryId, totalPids: result.length, data: result });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

router.get("/craft-options", async (req, res) => {
  const pid = Number(req.query.pid);
  const categoryId = Number(req.query.categoryId ?? 2);
  if (!pid) return res.status(400).json({ success: false, error: "pid required" });
  try {
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
    if (Object.keys(craftIdCount).length === 0) {
      return res.json({ success: false, error: "No options found for this process position" });
    }

    const filteredIds = Object.entries(craftIdCount)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => Number(id));

    const userId = decodeUserId(token);
    for (const item of defaults) {
      if (item.pid === pid && item.lapel === null) {
        // eslint-disable-next-line eqeqeq
        if ((item.memberId == 0 || (userId && item.memberId == userId)) && !filteredIds.includes(item.craftId)) {
          filteredIds.push(item.craftId);
        }
      }
    }

    const craftResp = await ktPost(`${CRAFT_BASE}/craft/listCraftByIdList`, token, filteredIds);

    const filteredIdSet = new Set(filteredIds);
    const seenIds = new Set();
    const seenNames = new Set();
    const options = [];
    for (const c of (craftResp.data || [])) {
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

    return res.json({ success: true, data: options });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/image/:imageId", async (req, res) => {
  const { imageId } = req.params;
  const CDN = "https://aws-static-webp.kutetailor.com";
  const url = `${CDN}/comm/craft/${imageId}.webp`;
  try {
    const r = await fetch(url, {
      headers: {
        Referer: "https://platform.kutetailor.com/",
        Origin: "https://platform.kutetailor.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });
    if (!r.ok) return res.status(r.status).end();
    const buf = await r.arrayBuffer();
    res.set("Content-Type", r.headers.get("content-type") || "image/webp");
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(Buffer.from(buf));
  } catch (err) {
    return res.status(502).end();
  }
});

router.get("/check-images", async (req, res) => {
  const pid = Number(req.query.pid);
  const categoryId = Number(req.query.categoryId ?? 2);
  if (!pid) return res.status(400).json({ error: "pid required" });
  try {
    const token = await getToken();
    const CRAFT_BASE = "/craft/craft";
    const CDN = "https://aws-static-webp.kutetailor.com/comm/process/craft";

    const defaultsResp = await ktFetch(`${CRAFT_BASE}/craft-default/selectByCategoryId?categoryId=${categoryId}`, token);
    const defaults = Array.isArray(defaultsResp.data) ? defaultsResp.data : [];
    const craftIds = [...new Set(defaults.filter(i => i.pid === pid && i.lapel === null).map(i => i.craftId))];

    const craftResp = await ktPost(`${CRAFT_BASE}/craft/listCraftByIdList`, token, craftIds);
    const crafts = craftResp.data || [];

    const results = await Promise.all(crafts.map(async (c) => {
      const url = c.ecode ? `${CDN}/${c.ecode}.jpeg` : null;
      let status = null;
      if (url) {
        try {
          const r = await fetch(url, { method: "HEAD" });
          status = r.status;
        } catch { status = 0; }
      }
      return {
        craftId: c.id,
        name: c.en || c.name,
        ecode: c.ecode,
        url,
        status,
        exists: status === 200,
      };
    }));

    const found = results.filter(r => r.exists).length;
    const missing = results.filter(r => !r.exists).length;
    return res.json({ pid, categoryId, found, missing, results });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

router.get("/probe-img-api", async (req, res) => {
  const imageId = Number(req.query.imageId ?? 2149);
  const craftId = Number(req.query.craftId ?? 22);
  try {
    const token = await getToken();
    const BASE = "/craft/craft";
    const paths = [
      `${BASE}/image/getById?id=${imageId}`,
      `${BASE}/image/getUrl?id=${imageId}`,
      `${BASE}/image/url?imageId=${imageId}`,
      `${BASE}/craft/image?imageId=${imageId}`,
      `${BASE}/craft/getImage?imageId=${imageId}`,
      `${BASE}/craft/imageUrl?id=${imageId}`,
      `${BASE}/image/selectById?id=${imageId}`,
      `${BASE}/image/info?id=${imageId}`,
      `/file/file/getById?id=${imageId}`,
      `/file/file/url?id=${imageId}`,
      `/file/getUrl?id=${imageId}`,
      `${BASE}/craft/detail?id=${craftId}`,
    ];
    const results = [];
    for (const p of paths) {
      const j = await ktFetch(p, token);
      results.push({ path: p, code: j.code, hasData: !!j.data, sample: typeof j.data === "string" ? j.data.slice(0, 200) : JSON.stringify(j).slice(0, 200) });
      if (j.code === "0" && j.data) break;
    }
    return res.json({ imageId, craftId, results });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

router.get("/probe-image", async (req, res) => {
  const craftId = Number(req.query.craftId);
  if (!craftId) return res.status(400).json({ error: "craftId required" });
  try {
    const token = await getToken();
    const craftResp = await ktPost("/craft/craft/craft/listCraftByIdList", token, [craftId]);
    const craft = (craftResp.data || [])[0];
    if (!craft) return res.json({ error: "craft not found", craftId });

    const CDN = "https://aws-static-webp.kutetailor.com";
    const ecode = craft.ecode || craft.code || "";
    const id = craft.id;

    const rawFields = Object.entries(craft)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .reduce((o, [k, v]) => ({ ...o, [k]: v }), {});

    const imageId = craft.imageId || craft.appImageId || null;
    const refererHeaders = {
      Referer: "https://platform.kutetailor.com/",
      Origin: "https://platform.kutetailor.com",
      "User-Agent": "Mozilla/5.0",
    };

    const candidates = [
      { url: `${CDN}/comm/craft/${imageId}.webp`, note: "imageId + referer", headers: refererHeaders },
      { url: `${CDN}/comm/craft/${imageId}.webp`, note: "imageId no referer", headers: {} },
      { url: `${CDN}/comm/fabric/${imageId}.webp`, note: "fabric/imageId + referer", headers: refererHeaders },
      { url: `${CDN}/comm/craft/${ecode}.webp`, note: "ecode + referer", headers: refererHeaders },
      { url: `${CDN}/comm/craft/${id}.webp`, note: "craftId + referer", headers: refererHeaders },
    ];

    const results = await Promise.all(
      candidates.map(async ({ url, note, headers }) => {
        try {
          const r = await fetch(url, { method: "HEAD", headers });
          return { url, note, status: r.status, ok: r.ok };
        } catch {
          return { url, note, status: 0, ok: false };
        }
      })
    );

    return res.json({ craftId, ecode, rawFields, results });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

router.get("/craft-catalog", async (req, res) => {
  const pid = Number(req.query.pid);
  if (!pid) return res.status(400).json({ success: false, error: "pid required" });
  try {
    const token = await getToken();
    const CRAFT_BASE = "/craft/craft";
    const attempts = [];

    const endpoints = [
      `${CRAFT_BASE}/craft/list`,
      `${CRAFT_BASE}/craft/selectAll`,
      `${CRAFT_BASE}/craft/listAll`,
      `${CRAFT_BASE}/craft/listByParentId?parentId=${pid}`,
      `${CRAFT_BASE}/craft/selectByParentId?parentId=${pid}`,
      `${CRAFT_BASE}/craft/tree`,
      `${CRAFT_BASE}/craft/children?parentId=${pid}`,
      `${CRAFT_BASE}/craft/listChildren?parentId=${pid}`,
      `${CRAFT_BASE}/craftProcess/list?pid=${pid}`,
      `${CRAFT_BASE}/process/list?pid=${pid}`,
      `${CRAFT_BASE}/craftItem/list?pid=${pid}`,
      `${CRAFT_BASE}/craft/page?parentId=${pid}&pageSize=50&pageNum=1`,
      `${CRAFT_BASE}/craft/page?pid=${pid}&size=50&page=1`,
    ];

    for (const ep of endpoints) {
      try {
        const j = await ktFetch(ep, token);
        const count = Array.isArray(j.data) ? j.data.length :
          (Array.isArray(j.data?.list) ? j.data.list.length : 0);
        attempts.push({ ep, code: j.code, count, sample: Array.isArray(j.data) ? j.data.slice(0, 2) : j.data?.list?.slice(0,2) ?? j });
      } catch {
        attempts.push({ ep, error: "failed" });
      }
    }

    return res.json({ pid, attempts });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/find-categories", async (req, res) => {
  try {
    const token = await getToken();
    const paths = [
      "/craft/craft/category/list",
      "/craft/craft/category/selectAll",
      "/craft/craft/category/getAll",
      "/craft/craft/craftCategory/list",
      "/craft/craft/craftCategory/selectAll",
      "/craft/category/list",
      "/craft/category/selectAll",
      "/garment/category/list",
      "/garment/garment/category/list",
      "/craft/craft/garmentCategory/list",
      "/craft/craft/craft/category/list",
    ];
    const results = [];
    for (const p of paths) {
      const j = await ktFetch(p, token);
      const count = Array.isArray(j.data) ? j.data.length : 0;
      results.push({ path: p, code: j.code, count, sample: Array.isArray(j.data) ? j.data.slice(0, 3) : j });
    }
    return res.json({ results });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

router.get("/craft-options-debug", async (req, res) => {
  const pid = Number(req.query.pid);
  const categoryId = Number(req.query.categoryId ?? 2);
  const token = await getToken();
  const CRAFT_BASE = "/craft/craft";
  const defaultsResp = await ktFetch(`${CRAFT_BASE}/craft-default/selectByCategoryId?categoryId=${categoryId}`, token);
  const defaults = Array.isArray(defaultsResp.data) ? defaultsResp.data : [];
  const craftIdCount = {};
  for (const item of defaults) {
    if (item.pid === pid && item.lapel === null) {
      craftIdCount[item.craftId] = (craftIdCount[item.craftId] || 0) + 1;
    }
  }
  const sorted = Object.entries(craftIdCount).sort((a,b) => b[1]-a[1]).map(([id,count]) => ({craftId: Number(id), count}));
  const craftResp = await ktPost(`${CRAFT_BASE}/craft/listCraftByIdList`, token, sorted.map(x=>x.craftId));
  const nameMap = Object.fromEntries((craftResp.data||[]).map(c=>[c.id, {name: c.en||c.name, code: c.ecode}]));
  const result = sorted.map(({craftId, count}) => ({craftId, count, ...nameMap[craftId]}));
  return res.json({pid, categoryId, total: defaults.length, result});
});

router.get("/probe-cats", async (req, res) => {
  const from = Number(req.query.from ?? 1);
  const to = Number(req.query.to ?? 50);
  try {
    const token = await getToken();
    const found = [];
    for (let id = from; id <= to; id++) {
      const j = await ktFetch(`/craft/craft/craft-default/selectByCategoryId?categoryId=${id}`, token);
      const total = Array.isArray(j.data) ? j.data.length : 0;
      if (total > 0) {
        const sys = j.data.filter(x => x.lapel === null && x.memberId == 0).length;
        found.push({ categoryId: id, total, sysDefaults: sys });
      }
    }
    return res.json({ found });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

router.get("/categories", async (_req, res) => {
  try {
    const token = await getToken();
    const json = await ktFetch("/craft/craft/category/selectAll", token);
    if (Array.isArray(json.data)) {
      return res.json({ success: true, data: json.data });
    }
    const json2 = await ktFetch("/craft/craft/craftCategory/list", token);
    if (Array.isArray(json2.data)) {
      return res.json({ success: true, data: json2.data });
    }
    return res.status(502).json({ success: false, error: "Could not fetch categories", raw: json });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

const GARMENT_CATEGORIES = [
  { categoryId: 2,    label: "Men Jacket"       },
  { categoryId: 1001, label: "Men Pants"         },
  { categoryId: 1002, label: "Men Vest"          },
  { categoryId: 1100, label: "Men Shirt"         },
  { categoryId: 1101, label: "Men Overcoat"      },
  { categoryId: 1502, label: "Men Tuxedo"        },
  { categoryId: 1506, label: "Men Short Pants"   },
  { categoryId: 1508, label: "Men Casual Coat"   },
  { categoryId: 1510, label: "Men Polo"          },
  { categoryId: 2570, label: "Men Kapota Jacket" },
];

router.get("/category-list", async (_req, res) => {
  return res.json({ success: true, data: GARMENT_CATEGORIES });
});

router.get("/crafts", async (req, res) => {
  const categoryId = Number(req.query.categoryId ?? 2);
  if (!categoryId) return res.status(400).json({ success: false, error: "categoryId required" });
  try {
    if (_craftsCache[categoryId] && Date.now() - _craftsCacheAt[categoryId] < CRAFTS_CACHE_TTL) {
      return res.json({ success: true, data: _craftsCache[categoryId], cached: true });
    }
    const token = await getToken();
    const crafts = await fetchCraftsByCategory(categoryId, token);
    _craftsCache[categoryId] = crafts;
    _craftsCacheAt[categoryId] = Date.now();
    return res.json({ success: true, data: crafts, cached: false });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

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

router.get("/read-shopify-metafield", async (_req, res) => {
  try {
    const { config } = await import("../config.js");
    const ENDPOINT = `${config.shopify.storeDomain}/admin/api/${config.shopify.apiVersion}/graphql.json`;
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": config.shopify.accessToken },
      body: JSON.stringify({ query: `{ shop { metafield(namespace:"custom",key:"fabric_options"){ id value updatedAt } } }` }),
    });
    const json = await r.json();
    const mf = json.data?.shop?.metafield;
    return res.json({
      exists: !!mf,
      updatedAt: mf?.updatedAt,
      valueLength: mf?.value?.length ?? 0,
      valueSample: mf?.value?.slice(0, 300) ?? null,
      errors: json.errors ?? null,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

router.post("/sync-to-shopify", async (req, res) => {
  const CDN = "https://aws-static-webp.kutetailor.com/comm/process/craft";
  const CRAFT_BASE = "/craft/craft";
  const CATS = [
    { label: "Men Jacket",  categoryId: 2    },
    { label: "Men Pants",   categoryId: 1001 },
    { label: "Men Vest",    categoryId: 1002 },
    { label: "Men Shirt",   categoryId: 1100 },
    { label: "Men Tuxedo",  categoryId: 2853 },
  ];

  try {
    const token = await getToken();
    const result = {};

    for (const cat of CATS) {
      const defaultsResp = await ktFetch(`${CRAFT_BASE}/craft-default/selectByCategoryId?categoryId=${cat.categoryId}`, token);
      const defaults = Array.isArray(defaultsResp.data) ? defaultsResp.data : [];

      const crafts = await fetchCraftsByCategory(cat.categoryId, token);
      const categoryData = {};

      const allCraftIds = [...new Set(defaults.filter(i => i.lapel === null).map(i => i.craftId))];
      const craftResp = await ktPost(`${CRAFT_BASE}/craft/listCraftByIdList`, token, allCraftIds);
      const craftMap = Object.fromEntries((craftResp.data || []).map(c => [c.id, c]));

      for (const craft of crafts) {
        const pidCraftIds = [...new Set(
          defaults.filter(i => i.pid === craft.pid && i.lapel === null).map(i => i.craftId)
        )];

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

    await setShopMetafield("custom", "fabric_options", result);

    const totalPositions = Object.values(result).reduce((s, c) => s + Object.keys(c).length, 0);
    const totalOptions = Object.values(result).reduce((s, c) => s + Object.values(c).reduce((ss, p) => ss + p.options.length, 0), 0);
    return res.json({ success: true, categories: CATS.length, totalPositions, totalOptions });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

export default router;
