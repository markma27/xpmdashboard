'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface PartnerRevenueData {
  partner: string
  'Current Year': number
  'Last Year': number
}

interface DashboardRevenueByPartnerChartProps {
  data: PartnerRevenueData[]
  loading?: boolean
}

export function DashboardRevenueByPartnerChart({ data, loading }: DashboardRevenueByPartnerChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice $ by Partner</CardTitle>
          <CardDescription>Current year vs last year</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartSkeleton />
        </CardContent>
      </Card>
    )
  }

  // Custom tooltip content
  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const currentYearPayload = payload.find((p: any) => p.dataKey === 'Current Year')
    const lastYearPayload = payload.find((p: any) => p.dataKey === 'Last Year')
    
    const formatCurrency = (value: number) => {
      if (value === 0) return '-'
      const absValue = Math.abs(value)
      const formatted = absValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      if (value < 0) {
        return `($${formatted})`
      }
      return `$${formatted}`
    }

    const currentYearValue = currentYearPayload?.value || 0
    const lastYearValue = lastYearPayload?.value || 0

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <div className="text-sm font-medium flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: currentYearPayload?.color || '#75CBA8' }}
          />
          <span>
            Current Year: {formatCurrency(currentYearValue)}
          </span>
        </div>
        <div className="text-sm font-medium flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: lastYearPayload?.color || '#9ca3af' }}
          />
          <span>
            Last Year: {formatCurrency(lastYearValue)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice $ by Partner</CardTitle>
        <CardDescription>Current year vs last year</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <RechartsBarChart
            data={data}
            margin={{ top: 40, right: 30, left: 5, bottom: 20 }}
          >
            <XAxis 
              dataKey="partner" 
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <Tooltip content={customTooltip} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar 
              dataKey="Current Year" 
              fill="#75CBA8" 
              name="Current Year"
              radius={[4, 4, 0, 0]}
            >
              <LabelList 
                dataKey="Current Year" 
                position="top"
                formatter={(value: number) => {
                  if (value === 0) return ''
                  const absValue = Math.abs(value)
                  const formatted = absValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                  return value < 0 ? `($${formatted})` : `$${formatted}`
                }}
                style={{ fontSize: '11px', fill: '#666' }}
              />
            </Bar>
            <Bar 
              dataKey="Last Year" 
              fill="#9ca3af" 
              name="Last Year"
              radius={[4, 4, 0, 0]}
            >
              <LabelList 
                dataKey="Last Year" 
                position="top"
                formatter={(value: number) => {
                  if (value === 0) return ''
                  const absValue = Math.abs(value)
                  const formatted = absValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                  return value < 0 ? `($${formatted})` : `$${formatted}`
                }}
                style={{ fontSize: '11px', fill: '#666' }}
              />
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
