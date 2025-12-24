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

interface MonthlyRevenueData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface RevenueMonthlyChartProps {
  data: MonthlyRevenueData[]
}

export function RevenueMonthlyChart({ data }: RevenueMonthlyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsBarChart
        data={data}
        margin={{ top: 40, right: 30, left: 5, bottom: 5 }}
      >
        <XAxis 
          dataKey="month" 
          tick={{ fontSize: 12 }}
        />
        <Tooltip 
          formatter={(value: number) => {
            if (value === 0) return ['-', '']
            return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, '']
          }}
          labelFormatter={(label) => `Month: ${label}`}
        />
        <Legend />
        <Bar 
          dataKey="Current Year" 
          fill="#fca5a5" 
          name="Current Year"
          radius={[4, 4, 0, 0]}
        >
          <LabelList 
            dataKey="Current Year" 
            position="top"
            formatter={(value: number) => {
              if (value === 0) return ''
              return `$${(value / 1000).toFixed(0)}k`
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
              return `$${(value / 1000).toFixed(0)}k`
            }}
            style={{ fontSize: '11px', fill: '#666' }}
          />
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

