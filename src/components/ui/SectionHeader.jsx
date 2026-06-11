export default function SectionHeader({
  title,
  badge,
  color = "text-gc-primary",
}) {
  return (
    <div className="flex items-center justify-between pb-[9px] border-b border-gc-primary-dark/20">
      <div className="flex items-center gap-[13px]">
        <div className="w-[3px] h-[20px] rounded-sm bg-gc-primary" />
        <h3
          className={`font-garamond text-[20px] sm:text-[28px] font-semibold ${color}`}
        >
          {title}
        </h3>
      </div>
      {badge && (
        <span className="font-hanken text-[10px] font-bold text-[rgba(28,28,25,0.5)] tracking-[1px] uppercase">
          {badge}
        </span>
      )}
    </div>
  );
}
