import { AlertCircle, CheckCircle2 } from "lucide-react";

const VARIANTS = {
  error: {
    wrap: "bg-red-50 border-red-200",
    icon: "text-red-500",
    title: "text-red-700 font-semibold",
    body: "text-red-600",
    Icon: AlertCircle,
  },
  warning: {
    wrap: "bg-amber-50 border-amber-200",
    icon: "text-amber-500",
    title: "text-amber-700 font-semibold",
    body: "text-amber-600",
    Icon: AlertCircle,
  },
  success: {
    wrap: "bg-emerald-50 border-emerald-200",
    icon: "text-emerald-500",
    title: "text-emerald-700 font-semibold",
    body: "text-emerald-600",
    Icon: CheckCircle2,
  },
};

export default function AlertBanner({ variant = "error", title, message }) {
  const v = VARIANTS[variant] ?? VARIANTS.error;
  return (
    <div
      className={`flex items-start gap-[10px] px-[16px] py-[12px] rounded-[8px] border ${v.wrap}`}
    >
      <v.Icon size={16} className={`${v.icon} flex-shrink-0 mt-[1px]`} />
      <div>
        {title && (
          <p className={`font-hanken text-[13px] ${v.title}`}>{title}</p>
        )}
        {message && (
          <p
            className={`font-hanken text-[${title ? "12" : "13"}px] ${title ? v.body : v.title} ${title ? "mt-[2px]" : ""}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
