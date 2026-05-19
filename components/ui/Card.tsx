import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: ReactNode
  action?: ReactNode
}

export default function Card({ children, className, title, action }: CardProps) {
  return (
    <div className={`bg-surface border border-border rounded ${className ?? ''}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          {title && <h3 className="text-2xs font-semibold tracking-widest text-ink-3 uppercase">{title}</h3>}
          {action && <div className="text-xs text-ink-3">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
