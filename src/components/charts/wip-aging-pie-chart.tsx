'use client'

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface AgingData {
  lessThan30: number
  days30to60: number
  days60to90: number
  days90to120: number
  days120Plus: number
  percentages: {
    lessThan30: number
    days30to60: number
    days60to90: number
    days90to120: number
    days120Plus: number
  }
}

interface WIPAgingPieChartProps {
  data: AgingData
}

// Colors: light green, light blue, light purple, light orange, light red
const COLORS = ['#86efac', '#93c5fd', '#c4b5fd', '#fdba74', '#fca5a5']

export function WIPAgingPieChart({ data }: WIPAgingPieChartProps) {
  const chartData = [
    { name: '< 30 days', value: data.percentages.lessThan30, amount: data.lessThan30 },
    { name: '30 - 60 days', value: data.percentages.days30to60, amount: data.days30to60 },
    { name: '60 - 90 days', value: data.percentages.days60to90, amount: data.days60to90 },
    { name: '90 - 120 days', value: data.percentages.days90to120, amount: data.days90to120 },
    { name: '120 days +', value: data.percentages.days120Plus, amount: data.days120Plus },
  ]

  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0]
    const percentage = data.value.toFixed(1)
    const amount = data.payload.amount

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <div className="text-sm font-medium">{data.name}</div>
        <div className="text-sm text-muted-foreground">
          {percentage}% ({new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(amount)})
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsPieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
          style={{ fontSize: '10px', fontWeight: 500 }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={customTooltip} />
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}

