import { Loader2 } from "lucide-react";

export default function LoadingState({
  message = "Loading orders…",
  progress = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-[72px] gap-[14px]">
      <Loader2 size={30} className="text-brand-600 animate-spin" />
      <div className="text-center">
        <p className="text-15 font-medium text-text-primary">{message}</p>
        {progress !== null && progress > 0 && (
          <p className="text-13 text-text-muted mt-[4px]">
            Fetched {progress} order{progress !== 1 ? "s" : ""} so far…
          </p>
        )}
      </div>
    </div>
  );
}
