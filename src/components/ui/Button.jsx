import { cn } from '../../utils/cn'

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
}

export default function Button({ variant = 'primary', children, className, icon: Icon, ...props }) {
  return (
    <button className={cn(VARIANTS[variant], 'gap-[8px]', className)} {...props}>
      {Icon && <Icon size={15} />}
      {children}
    </button>
  )
}
