'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="month" 
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          label={{ 
            value: "Billings ($)", 
            angle: -90, 
            position: 'insideLeft',
            style: { textAnchor: 'middle' }
          }}
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
        />
        <Bar 
          dataKey="Last Year" 
          fill="#9ca3af" 
          name="Last Year"
          radius={[4, 4, 0, 0]}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

