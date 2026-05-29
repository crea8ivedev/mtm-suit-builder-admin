import { Router } from "express";
import {
  createCustomer,
  setCustomerProductsMetafield,
  syncAllCustomerProfiles,
  gqlQuery,
} from "../services/shopify.js";

const router = Router();

router.post("/", async (req, res) => {
  const { firstName, lastName, email, phone } = req.body;

  if (!firstName?.trim())
    return res
      .status(400)
      .json({ error: "First name is required", field: "firstName" });
  if (!lastName?.trim())
    return res
      .status(400)
      .json({ error: "Last name is required", field: "lastName" });
  if (!email?.trim())
    return res.status(400).json({ error: "Email is required", field: "email" });

  console.log(`[customers] creating ${email}`);

  try {
    const customer = await createCustomer({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone?.trim(),
    });
    console.log(`[customers] created ${customer.id}`);
    return res.json({ success: true, customer });
  } catch (err) {
    console.error("[customers] create failed:", err.message);
    const status = err.field ? 422 : 502;
    return res
      .status(status)
      .json({ error: err.message, field: err.field ?? null });
  }
});

let syncLock = false;

// POST /api/customers/sync-all
router.post("/sync-all", async (req, res) => {
  if (syncLock) {
    return res.json({
      success: true,
      synced: 0,
      skipped: 0,
      total: 0,
      locked: true,
    });
  }
  syncLock = true;
  const { since } = req.body ?? {};
  console.log(
    "[customers] sync-all started",
    since ? `since ${since}` : "(full)",
  );
  try {
    const result = await syncAllCustomerProfiles(since || null);
    console.log(`[customers] sync-all done: ${JSON.stringify(result)}`);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[customers] sync-all failed:", err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    syncLock = false;
  }
});

// POST /api/customers/:id/sync-products
// Saves unique ordered products to profiles.gc_measurements metafield
router.post("/:id/sync-products", async (req, res) => {
  const customerGid = `gid://shopify/Customer/${req.params.id}`;
  const { data } = req.body;

  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "data object required" });
  }

  try {
    await setCustomerProductsMetafield(customerGid, data);
    const count = Object.values(data).reduce(
      (s, a) => s + (Array.isArray(a) ? a.length : 0),
      0,
    );
    console.log(`[customers] synced ${count} profiles → ${customerGid}`);
    return res.json({ success: true, count });
  } catch (err) {
    console.error("[customers] sync-products failed:", err.message);
    return res.status(502).json({ error: err.message });
  }
});

router.get("/vest-ranges-debug", async (_req, res) => {
  try {
    const types = ["vest_custom_measurement", "vest_measurement", "vestCustomMeasurement", "vest_custom_measurements"];
    const results = {};
    for (const type of types) {
      const data = await gqlQuery(`{
        metaobjects(type: "${type}", first: 10) {
          edges { node { handle displayName fields { key value } } }
        }
      }`);
      const edges = data?.metaobjects?.edges ?? [];
      results[type] = { count: edges.length, sample: edges.slice(0, 2) };
    }
    return res.json(results);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

const VEST_ENTRIES = [
  { handle: "v_neck",                 key: "v_neck",                 label: "Neck",               min: "11.8", max: "27.6", required: "true"  },
  { handle: "v_chest",                key: "v_chest",                label: "Chest",              min: "26.0", max: "88.2", required: "true"  },
  { handle: "v_stomach",              key: "v_stomach",              label: "Stomach",            min: "21.7", max: "86.2", required: "true"  },
  { handle: "v_nape_to_waist",        key: "v_nape_to_waist",        label: "Nape To Waist",      min: "10.6", max: "24.8", required: "true"  },
  { handle: "v_front_waist_length",   key: "v_front_waist_length",   label: "Front Waist Length", min: "11.8", max: "29.5", required: "false" },
  { handle: "v_front_waist_height",   key: "v_front_waist_height",   label: "Front Waist Height", min: "0.0",  max: "11.8", required: "false" },
  { handle: "v_back_waist_height",    key: "v_back_waist_height",    label: "Back Waist Height",  min: "0.0",  max: "6.7",  required: "false" },
  { handle: "v_shoulder",             key: "v_shoulder",             label: "Shoulder",           min: "12.2", max: "28.3", required: "false" },
  { handle: "v_back_length",          key: "v_back_length",          label: "Back Length",        min: "15.0", max: "30.7", required: "false" },
  { handle: "v_front_shoulder",       key: "v_front_shoulder",       label: "Front Shoulder",     min: "11.4", max: "26.8", required: "false" },
  { handle: "v_first_button_position",key: "v_first_button_position",label: "1st Button Position",min: "7.5",  max: "23.6", required: "false" },
  { handle: "v_highest_point_of",     key: "v_highest_point_of",     label: "Highest Point Of",   min: "22.8", max: "72.8", required: "false" },
];

router.post("/vest-ranges/seed", async (_req, res) => {
  try {
    const results = [];
    for (const entry of VEST_ENTRIES) {
      const data = await gqlQuery(`
        mutation MetaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
          metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
            metaobject { handle }
            userErrors { field message }
          }
        }
      `, {
        handle: { type: "vest_custom_measurement", handle: entry.handle },
        metaobject: {
          fields: [
            { key: "key",      value: entry.key      },
            { key: "label",    value: entry.label    },
            { key: "min",      value: entry.min      },
            { key: "max",      value: entry.max      },
            { key: "required", value: entry.required },
          ],
        },
      });
      const errors = data?.metaobjectUpsert?.userErrors ?? [];
      results.push({ handle: entry.handle, ok: errors.length === 0, errors });
    }
    _vestRangesCache = null;
    _vestRangesCacheAt = 0;
    return res.json({ success: true, results });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

let _vestRangesCache = null;
let _vestRangesCacheAt = 0;
const VEST_CACHE_TTL = 30 * 60 * 1000;

router.get("/vest-ranges", async (_req, res) => {
  if (_vestRangesCache && Date.now() - _vestRangesCacheAt < VEST_CACHE_TTL) {
    return res.json({ success: true, data: _vestRangesCache, cached: true });
  }

  try {
    const data = await gqlQuery(`{
      metaobjects(type: "vest_custom_measurement", first: 250) {
        edges {
          node {
            handle
            displayName
            fields { key value }
          }
        }
      }
    }`);

    const entries = data?.metaobjects?.edges ?? [];

    // Simple flat map: every possible key variant → { label, min, max }
    const map = {};

    for (const { node } of entries) {
      const fields = Object.fromEntries(node.fields.map(f => [f.key, f.value]));
      const label = fields.label;
      const vKey  = fields.key ?? node.handle;
      const min   = parseFloat(fields.min ?? 0);
      const max   = parseFloat(fields.max ?? 0);
      if (!label || isNaN(min) || isNaN(max)) continue;

      const entry = { label, min, max, hint: `${min}–${max}` };

      // Register under every key format orders might use
      map[vKey]             = entry;   // v_neck
      map[`Vest ${vKey}`]   = entry;   // Vest v_neck
      map[label]            = entry;   // Neck
      map[`Vest ${label}`]  = entry;   // Vest Neck
    }

    _vestRangesCache = map;
    _vestRangesCacheAt = Date.now();
    return res.json({ success: true, data: map, cached: false });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

export default router;
