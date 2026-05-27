import {
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { cn } from '../../utils/cn'

const ICONS = { ShoppingBag, Clock, CheckCircle, XCircle }

export default function StatCard({ label, value, change, changeType, icon, bgColor, iconColor }) {
  const Icon = ICONS[icon] || ShoppingBag

  return (
    <div className="card p-[20px] md:p-[24px] flex items-start gap-[16px] hover:shadow-md transition-shadow duration-200">
      <div
        className="w-[50px] h-[50px] rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        <Icon size={22} style={{ color: iconColor }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-13 text-text-muted font-medium mb-[4px] truncate">{label}</p>
        <p className="text-32 font-bold text-text-primary leading-none">{value}</p>

        {change && (
          <div className="flex items-center gap-[4px] mt-[8px]">
            {changeType === 'positive' && (
              <TrendingUp size={12} className="text-submitted flex-shrink-0" />
            )}
            {changeType === 'negative' && (
              <TrendingDown size={12} className="text-failed flex-shrink-0" />
            )}
            {changeType === 'neutral' && (
              <Minus size={12} className="text-text-muted flex-shrink-0" />
            )}
            <span
              className={cn(
                'text-12 font-medium',
                changeType === 'positive' && 'text-submitted',
                changeType === 'negative' && 'text-failed',
                changeType === 'neutral' && 'text-text-muted'
              )}
            >
              {change}
            </span>
            <span className="text-12 text-text-muted">vs last month</span>
          </div>
        )}
      </div>
    </div>
  )
}
