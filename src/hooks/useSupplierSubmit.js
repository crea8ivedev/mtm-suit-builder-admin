import { useState, useCallback } from "react";
import { sendToKutetailor } from "../lib/kutetailor";
import { getOrderForSupplier, setOrderMetafields } from "../lib/shopify";
import { invalidateOrdersCache, setOrderSupplierOverride } from "./useOrders";

export const SUPPLIERS = [
  { id: "kutetailor", name: "Kutetailor", enabled: true },
];

const HANDLERS = {
  kutetailor: sendToKutetailor,
};

async function handleSendToSupplier(orderId, supplierId) {
  const supplier = SUPPLIERS.find((s) => s.id === supplierId && s.enabled);
  if (!supplier) throw new Error(`Unknown supplier: ${supplierId}`);
  const handler = HANDLERS[supplierId];
  if (!handler) throw new Error(`No handler for: ${supplierId}`);

  const shopifyGid = `gid://shopify/Order/${orderId}`;

  await setOrderMetafields(shopifyGid, [
    { key: "supplier_name", value: supplier.id },
    { key: "supplier_status", value: "processing" },
  ]).catch(() => {});

  const order = await getOrderForSupplier(shopifyGid);
  const result = await handler(order);

  const refRaw = result?.response?.data;
  const supplierRef = refRaw
    ? typeof refRaw === "object"
      ? String(
          refRaw.orderId ??
            refRaw.orderNo ??
            refRaw.id ??
            JSON.stringify(refRaw),
        )
      : String(refRaw)
    : "";

  await setOrderMetafields(shopifyGid, [
    { key: "supplier_name", value: supplier.id },
    { key: "supplier_status", value: "submitted" },
    { key: "supplier_submitted_at", value: new Date().toISOString() },
    { key: "supplier_error", value: "" },
    ...(supplierRef ? [{ key: "supplier_reference", value: supplierRef }] : []),
  ]);

  return result;
}

export function useSupplierSubmit(orderId, onSettled) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const submit = useCallback(
    async (supplierId) => {
      if (!supplierId) return;
      setSubmitting(true);
      setSubmitError(null);
      let errMsg = null;
      try {
        await handleSendToSupplier(orderId, supplierId);
      } catch (err) {
        console.error("[KT] submission failed:", err);
        errMsg = err?.message || String(err) || "Submission failed";
      } finally {
        setSubmitting(false);

        if (errMsg) {
          // Update Shopify status to "failed" — retry once if the first attempt fails
          const shopifyGid = `gid://shopify/Order/${orderId}`;
          const safeErr = errMsg.slice(0, 500);
          const updateFailed = () =>
            setOrderMetafields(shopifyGid, [
              { key: "supplier_status", value: "failed" },
              { key: "supplier_error", value: safeErr },
            ]);
          await updateFailed()
            .catch(() => updateFailed())
            .catch(() => {});
          setSubmitError(errMsg);
        }

        if (!errMsg) {
          invalidateOrdersCache();
          setOrderSupplierOverride(
            `gid://shopify/Order/${orderId}`,
            "submitted",
          );
        }

        await onSettled?.();

        if (errMsg) setSubmitError(errMsg);
      }
    },
    [orderId, onSettled],
  );

  const retry = useCallback((supplierId) => submit(supplierId), [submit]);

  return { submit, retry, submitting, submitError };
}
