import { cn } from "../../utils/cn";

const VARIANTS = {
  paid: "text-submitted bg-submitted-bg",
  pending: "text-pending bg-pending-bg",
  shipped: "text-brand-700 bg-brand-100",
  processing: "text-processing bg-processing-bg",
  verified: "text-submitted bg-submitted-bg",
  failed: "text-failed bg-failed-bg",
  fulfilled: "text-brand-600 bg-brand-50",
  unfulfilled: "text-gray-500 bg-gray-100",
};

const DOT_COLORS = {
  paid: "bg-submitted",
  pending: "bg-pending",
  shipped: "bg-brand-700",
  processing: "bg-processing",
  verified: "bg-submitted",
  failed: "bg-failed",
  fulfilled: "bg-brand-600",
  unfulfilled: "bg-gray-400",
};

const LABELS = {
  paid: "Paid",
  pending: "Pending",
  shipped: "Shipped",
  processing: "Processing",
  verified: "Verified",
  failed: "Failed",
  fulfilled: "Fulfilled",
  unfulfilled: "Unfulfilled",
};

export default function Badge({ status, className }) {
  const variant = VARIANTS[status] || "text-gray-500 bg-gray-100";
  const dotColor = DOT_COLORS[status] || "bg-gray-400";
  const label = LABELS[status] || status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-12 font-medium",
        variant,
        className,
      )}
    >
      <span
        className={cn("w-[6px] h-[6px] rounded-full flex-shrink-0", dotColor)}
      />
      {label}
    </span>
  );
}
