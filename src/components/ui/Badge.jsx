import { cn } from '../../utils/cn'

const VARIANTS = {
  pending: 'text-pending bg-pending-bg',
  submitted: 'text-submitted bg-submitted-bg',
  failed: 'text-failed bg-failed-bg',
  processing: 'text-processing bg-processing-bg',
  paid: 'text-submitted bg-submitted-bg',
  unpaid: 'text-failed bg-failed-bg',
  partial: 'text-pending bg-pending-bg',
  fulfilled: 'text-brand-600 bg-brand-50',
  unfulfilled: 'text-gray-500 bg-gray-100',
}

const DOT_COLORS = {
  pending: 'bg-pending',
  submitted: 'bg-submitted',
  failed: 'bg-failed',
  processing: 'bg-processing',
  paid: 'bg-submitted',
  unpaid: 'bg-failed',
  partial: 'bg-pending',
  fulfilled: 'bg-brand-600',
  unfulfilled: 'bg-gray-400',
}

const LABELS = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  partial: 'Partial',
  fulfilled: 'Fulfilled',
  unfulfilled: 'Unfulfilled',
  pending: 'Pending',
  submitted: 'Submitted',
  failed: 'Failed',
  processing: 'Processing',
}

export default function Badge({ status, className }) {
  const variant = VARIANTS[status] || 'text-gray-500 bg-gray-100'
  const dotColor = DOT_COLORS[status] || 'bg-gray-400'
  const label = LABELS[status] || status

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-12 font-medium',
        variant,
        className
      )}
    >
      <span className={cn('w-[6px] h-[6px] rounded-full flex-shrink-0', dotColor)} />
      {label}
    </span>
  )
}
