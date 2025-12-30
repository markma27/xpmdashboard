'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts'

interface AgingData {
  lessThan30: number
  days30to60: number
  days60to90: number
  days90to120: number
  days120Plus: number
}

interface WIPAgingBarChartProps {
  data: AgingData
}

// Colors matching pie chart: light green, light blue, light purple, light orange, light red
const COLORS = ['#86efac', '#93c5fd', '#c4b5fd', '#fdba74', '#fca5a5']

export function WIPAgingBarChart({ data }: WIPAgingBarChartProps) {
  const chartData = [
    { name: '< 30 days', amount: data.lessThan30 },
    { name: '30 - 60 days', amount: data.days30to60 },
    { name: '60 - 90 days', amount: data.days60to90 },
    { name: '90 - 120 days', amount: data.days90to120 },
    { name: '120 days +', amount: data.days120Plus },
  ]

  const formatAmount = (amount: number) => {
    if (amount === 0) return '-'
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const amount = payload[0].value || 0
    const name = payload[0].payload.name

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <div className="text-sm font-medium">
          {name}: {formatAmount(amount)}
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsBarChart
        data={chartData}
        margin={{ top: 30, right: 30, left: 5, bottom: 10 }}
      >
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <Tooltip content={customTooltip} />
        <Bar 
          dataKey="amount" 
          radius={[3, 3, 0, 0]}
          barSize={50}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
          <LabelList 
            dataKey="amount" 
            position="top"
            formatter={(value: number) => {
              if (value === 0) return ''
              return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            }}
            style={{ fontSize: '9px', fill: '#475569', fontWeight: 600 }}
          />
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

