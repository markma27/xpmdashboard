interface PageHeaderProps {
  title: string
  description?: string
  organizationName?: string
}

export function PageHeader({ title, description, organizationName }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {organizationName && (
            <>
              <div className="h-5 w-px bg-gray-300" />
              <span className="text-base font-normal text-slate-400 tracking-normal">{organizationName}</span>
            </>
          )}
        </div>
        {description && (
          <p className="text-xs text-red-800 mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
