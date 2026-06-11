import { cn } from "../../utils/cn";

const SP_CLASS = {
  paid: "sp-paid",
  verified: "sp-verified",
  shipped: "sp-shipped",
  processing: "sp-processing",
  pending: "sp-pending",
  failed: "sp-failed",
};

export default function StatusPill({ status }) {
  const s = (status ?? "").toLowerCase();
  return (
    <span className={cn("status-pill", SP_CLASS[s] ?? "sp-default")}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}
