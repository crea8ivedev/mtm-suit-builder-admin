import { Router } from "express";
import {
  getOrder,
  setOrderMetafields,
  createDraftOrder,
  completeDraftOrder,
  updateOrder,
  getProductFields,
} from "../services/shopify.js";
import { sendToKutetailor } from "../services/kutetailor.js";
import { SUPPLIERS } from "./suppliers.js";

const router = Router();

const HANDLERS = {
  kutetailor: sendToKutetailor,
};

// ─── Get field keys for a product (from past orders) ───────────────────────
router.get("/product-fields", async (req, res) => {
  const { productId } = req.query;
  if (!productId) return res.status(400).json({ error: "productId required" });
  try {
    const fields = await getProductFields(productId);
    return res.json({ fields });
  } catch (err) {
    console.error("[product-fields]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Create new order ───────────────────────────────────────────────────────
router.post("/create", async (req, res) => {
  const { customerId, lineItems, note, tags } = req.body;
  if (!customerId)
    return res.status(400).json({ error: "customerId is required" });
  if (!lineItems?.length)
    return res.status(400).json({ error: "lineItems are required" });

  try {
    const draft = await createDraftOrder({
      customerId,
      lineItems: lineItems.map((item) => ({
        title: item.title,
        quantity: item.quantity || 1,
        originalUnitPrice: String(item.originalUnitPrice || "0.00"),
        customAttributes: (item.customAttributes || []).map(
          ({ key, value }) => ({
            key,
            value: String(value),
          }),
        ),
      })),
      note: note || "",
      tags: tags || ["admin-created"],
    });

    const order = await completeDraftOrder(draft.id, true);
    const numericId = order.id.split("/").pop();

    console.log(`[create-order] ${order.name} (${numericId})`);
    return res.json({
      success: true,
      orderId: numericId,
      orderName: order.name,
      shopifyGid: order.id,
    });
  } catch (err) {
    console.error("[create-order] failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Update order note / tags ───────────────────────────────────────────────
router.patch("/:orderId", async (req, res) => {
  const { orderId } = req.params;
  const { note, tags } = req.body;
  const shopifyGid = `gid://shopify/Order/${orderId}`;

  try {
    const order = await updateOrder(shopifyGid, { note, tags });
    return res.json({ success: true, order });
  } catch (err) {
    console.error(`[update-order] order=${orderId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Send / Retry supplier ──────────────────────────────────────────────────
async function handleSend(req, res) {
  const { orderId } = req.params;
  const { supplierId } = req.body;

  if (!supplierId)
    return res.status(400).json({ error: "supplierId is required" });

  const supplier = SUPPLIERS.find((s) => s.id === supplierId && s.enabled);
  if (!supplier)
    return res.status(400).json({ error: `Unknown supplier: ${supplierId}` });

  const handler = HANDLERS[supplierId];
  if (!handler)
    return res.status(400).json({ error: `No handler for: ${supplierId}` });

  const shopifyGid = `gid://shopify/Order/${orderId}`;
  console.log(`[send] order=${orderId} supplier=${supplier.name}`);

  await setOrderMetafields(shopifyGid, [
    { key: "supplier_name", value: supplier.id },
    { key: "supplier_status", value: "processing" },
    { key: "supplier_error", value: "" },
  ]).catch((e) =>
    console.warn("[send] metafield write (processing):", e.message),
  );

  try {
    const order = await getOrder(shopifyGid);
    const result = await handler(order);

    console.log(`[send] success order=${orderId}`, result.response);

    await setOrderMetafields(shopifyGid, [
      { key: "supplier_name", value: supplier.id },
      { key: "supplier_status", value: "submitted" },
      { key: "supplier_submitted_at", value: new Date().toISOString() },
      { key: "supplier_error", value: "" },
    ]);

    return res.json({
      success: true,
      supplier: supplier.id,
      data: result.response,
    });
  } catch (err) {
    console.error(`[send] failed order=${orderId}:`, err.message);

    await setOrderMetafields(shopifyGid, [
      { key: "supplier_name", value: supplier.id },
      { key: "supplier_status", value: "failed" },
      { key: "supplier_error", value: err.message },
    ]).catch(() => {});

    return res.status(502).json({ error: err.message, supplier: supplier.id });
  }
}

router.post("/:orderId/send-to-supplier", handleSend);
router.post("/:orderId/retry", handleSend);

export default router;
