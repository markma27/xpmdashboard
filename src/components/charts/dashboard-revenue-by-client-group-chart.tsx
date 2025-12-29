'use client'

import { useMemo } from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface ClientGroupRevenueData {
  clientGroup: string
  'Current Year': number
  'Last Year': number
}

interface DashboardRevenueByClientGroupChartProps {
  data: ClientGroupRevenueData[]
  loading?: boolean
}

export function DashboardRevenueByClientGroupChart({ data, loading }: DashboardRevenueByClientGroupChartProps) {
  // Calculate dynamic width for Y-axis based on longest client group name
  const yAxisWidth = useMemo(() => {
    if (!data || data.length === 0) return 60
    
    // Find the longest client group name
    const longestName = data.reduce((longest, item) => {
      const name = item.clientGroup || ''
      return name.length > longest.length ? name : longest
    }, '')
    
    // Estimate width: approximately 5.5-6 pixels per character for fontSize 11
    // More accurate estimation to reduce blank space
    const estimatedWidth = Math.max(longestName.length * 5.5, 60)
    // Cap at reasonable maximum to prevent excessive width
    return Math.min(estimatedWidth, 120)
  }, [data])

  if (loading) {
    return <ChartSkeleton />
  }

  // Custom tooltip content
  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const currentYearPayload = payload.find((p: any) => p.dataKey === 'Current Year')
    
    const formatCurrency = (value: number) => {
      if (value === 0 || isNaN(value) || value === null || value === undefined) return '-'
      const absValue = Math.abs(value)
      const formatted = absValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      if (value < 0) {
        return `($${formatted})`
      }
      return `$${formatted}`
    }

    const currentYearValue = currentYearPayload?.value || 0

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <div className="text-sm font-medium mb-2">{payload[0]?.payload?.clientGroup || ''}</div>
        <div className="text-sm font-medium flex items-center gap-2">
          <span>
            {formatCurrency(currentYearValue)}
          </span>
        </div>
      </div>
    )
  }

  // Format currency for label
  const formatCurrencyLabel = (value: number) => {
    if (value === 0 || isNaN(value) || value === null || value === undefined) return ''
    const absValue = Math.abs(value)
    const formatted = absValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return value < 0 ? `(${formatted})` : `$${formatted}`
  }

  // Custom YAxis tick to prevent text wrapping
  const CustomYAxisTick = ({ x, y, payload }: any) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={4}
          textAnchor="end"
          fill="#64748b"
          fontSize={11}
          fontWeight={500}
          style={{ whiteSpace: 'nowrap' }}
        >
          {payload.value}
        </text>
      </g>
    )
  }

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Top 10 Invoice $ by Client Group</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ResponsiveContainer width="100%" height={400}>
          <RechartsBarChart
            data={data}
            layout="vertical"
            margin={{ top: 20, right: 60, left: yAxisWidth, bottom: 20 }}
          >
            <XAxis 
              type="number"
              hide={true}
            />
            <YAxis 
              type="category"
              dataKey="clientGroup"
              tick={CustomYAxisTick}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              width={yAxisWidth}
              interval={0}
            />
            <Tooltip content={customTooltip} />
            <Bar 
              dataKey="Current Year" 
              fill="#93c5fd" 
              radius={[0, 3, 3, 0]}
            >
              <LabelList 
                dataKey="Current Year" 
                position="right"
                formatter={formatCurrencyLabel}
                style={{ fontSize: '9px', fill: '#475569', fontWeight: 600 }}
              />
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
