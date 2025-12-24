'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'

interface PartnerData {
  partner: string
  amount: number
}

interface WIPPartnerChartProps {
  data: PartnerData[]
}

export function WIPPartnerChart({ data }: WIPPartnerChartProps) {
  const formatAmount = (amount: number) => {
    if (amount === 0) return '-'
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  // Split name into first and last name
  const splitName = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' }
    }
    const lastName = parts.pop() || ''
    const firstName = parts.join(' ')
    return { firstName, lastName }
  }

  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const amount = payload[0].value || 0
    const partner = payload[0].payload.partner

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <div className="text-sm font-medium">
          {partner}: {formatAmount(amount)}
        </div>
      </div>
    )
  }

  // Custom tick component to display name in two lines
  const CustomTick = (props: any) => {
    const { x, y, payload, index } = props
    
    // Get name - try index first, then payload
    let name = ''
    if (index !== undefined && index >= 0 && index < data.length && data[index]) {
      name = data[index].partner || ''
    } else if (payload !== undefined && payload !== null) {
      if (typeof payload === 'string') {
        name = payload
      } else if (payload.value !== undefined) {
        name = String(payload.value)
      } else {
        name = String(payload)
      }
    }
    
    if (!name) {
      // Return empty group if no name
      return <g />
    }
    
    const { firstName, lastName } = splitName(name)
    
    return (
      <g transform={`translate(${x},${y + 15})`}>
        <text x={0} y={0} dy={0} textAnchor="middle" fill="#666" fontSize={12}>
          <tspan x="0" dy="0">{firstName || name}</tspan>
          {lastName && <tspan x="0" dy="14">{lastName}</tspan>}
        </text>
      </g>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsBarChart
        data={data}
        margin={{ top: 40, right: 30, left: 5, bottom: 30 }}
      >
        <XAxis 
          dataKey="partner" 
          tick={CustomTick}
          height={55}
          interval={0}
          allowDuplicatedCategory={false}
          tickLine={false}
        />
        <Tooltip content={customTooltip} />
        <Bar 
          dataKey="amount" 
          fill="#c4b5fd" 
          radius={[4, 4, 0, 0]}
        >
          <LabelList 
            dataKey="amount" 
            position="top"
            formatter={(value: number) => {
              if (value === 0) return ''
              return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            }}
            style={{ fontSize: '12px', fill: '#666' }}
          />
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

