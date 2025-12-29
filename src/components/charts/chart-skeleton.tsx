import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ChartSkeletonProps {
  title?: string
}

export function ChartSkeleton({ title }: ChartSkeletonProps = {}) {
  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-3 px-6">
        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">
          <span className="inline-block h-5 w-48 bg-muted animate-pulse rounded" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="h-[320px] bg-muted/30 animate-pulse rounded" />
      </CardContent>
    </Card>
  )
}

export function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-block h-6 w-48 bg-muted animate-pulse rounded" />
        </CardTitle>
        <CardDescription>
          <span className="inline-block h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Table header skeleton */}
          <div className="h-12 bg-muted/30 animate-pulse rounded" />
          {/* Table rows skeleton */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted/20 animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

