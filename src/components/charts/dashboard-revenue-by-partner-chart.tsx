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
    return <ChartSkeleton />
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
            style={{ backgroundColor: currentYearPayload?.color || '#fca5a5' }}
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
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Invoice $ by Partner</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <ResponsiveContainer width="100%" height={260}>
          <RechartsBarChart
            data={data}
            margin={{ top: 30, right: 30, left: 5, bottom: 10 }}
          >
            <XAxis 
              dataKey="partner" 
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip content={customTooltip} />
            <Legend 
              wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '10px' }} 
              iconType="circle"
              iconSize={8}
            />
            <Bar 
              dataKey="Current Year" 
              fill="#fca5a5" 
              name="Current Year"
              radius={[3, 3, 0, 0]}
              barSize={50}
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
                style={{ fontSize: '9px', fill: '#475569', fontWeight: 600 }}
              />
            </Bar>
            <Bar 
              dataKey="Last Year" 
              fill="#cbd5e1" 
              name="Last Year"
              radius={[3, 3, 0, 0]}
              barSize={50}
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
                style={{ fontSize: '9px', fill: '#64748b', fontWeight: 600 }}
              />
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
