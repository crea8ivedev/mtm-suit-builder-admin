import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-[72px] gap-[14px]">
      <div className="w-[48px] h-[48px] rounded-full bg-red-50 flex items-center justify-center">
        <AlertCircle size={22} className="text-red-500" />
      </div>
      <div className="text-center">
        <p className="text-15 font-semibold text-text-primary">
          Failed to load orders
        </p>
        <p className="text-13 text-text-muted mt-[4px] max-w-[360px] leading-relaxed">
          {message}
        </p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary gap-[6px]">
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  );
}
