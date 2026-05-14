import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  status?: ReactNode
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, status, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {status}
        </div>
        {subtitle && <p className="text-sm text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
