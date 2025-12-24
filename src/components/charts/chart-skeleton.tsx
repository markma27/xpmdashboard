import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ChartSkeleton() {
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
        <div className="h-[400px] bg-muted/30 animate-pulse rounded" />
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

