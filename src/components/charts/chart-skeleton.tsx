import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ChartSkeletonProps {
  title?: string
}

export function ChartSkeleton({ title }: ChartSkeletonProps = {}) {
  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">
          <span className="inline-block h-4 w-40 bg-muted animate-pulse rounded" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="h-[260px] bg-muted/30 animate-pulse rounded" />
      </CardContent>
    </Card>
  )
}

export function TableSkeleton() {
  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">
          <span className="inline-block h-5 w-48 bg-muted animate-pulse rounded" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-4">
        <div className="space-y-3 px-4 pb-4">
          {/* Table header skeleton */}
          <div className="h-10 bg-muted/30 animate-pulse rounded" />
          {/* Table rows skeleton */}
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-8 bg-muted/20 animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

