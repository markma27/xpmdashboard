interface PageHeaderProps {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs text-red-800 mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
