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

interface MonthlyBillableData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface BillableMonthlyChartProps {
  data: MonthlyBillableData[]
}

export function BillableMonthlyChart({ data }: BillableMonthlyChartProps) {
  // Calculate financial year based on current date
  const now = new Date()
  const currentMonth = now.getMonth() // 0-11
  const currentYear = now.getFullYear()
  
  // Determine current financial year
  let currentFYStartYear: number
  if (currentMonth >= 6) {
    currentFYStartYear = currentYear
  } else {
    currentFYStartYear = currentYear - 1
  }
  
  const currentFYEndYear = currentFYStartYear + 1
  const lastFYStartYear = currentFYStartYear - 1
  const lastFYEndYear = currentFYStartYear

  // Custom tooltip content
  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    const monthIndex = data.findIndex((d) => d.month === label)
    if (monthIndex === -1) return null

    // Determine years based on month index
    // July (0) to December (5) = first year of FY
    // January (6) to June (11) = second year of FY
    const currentYearValue = monthIndex < 6 ? currentFYStartYear : currentFYEndYear
    const lastYearValue = monthIndex < 6 ? lastFYStartYear : lastFYEndYear

    // Format month abbreviation (first 3 letters)
    const monthAbbr = label.substring(0, 3)

    const currentYearPayload = payload.find((p: any) => p.dataKey === 'Current Year')
    const lastYearPayload = payload.find((p: any) => p.dataKey === 'Last Year')
    
    const currentYearAmount = currentYearPayload?.value || 0
    const lastYearAmount = lastYearPayload?.value || 0

    const formatAmount = (amount: number) => {
      if (amount === 0) return '-'
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <div className="text-sm font-medium flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: currentYearPayload?.color || '#75CBA8' }}
          />
          <span>
            {monthAbbr} {currentYearValue}: {formatAmount(currentYearAmount)}
          </span>
        </div>
        <div className="text-sm font-medium flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: lastYearPayload?.color || '#9ca3af' }}
          />
          <span>
            {monthAbbr} {lastYearValue}: {formatAmount(lastYearAmount)}
          </span>
        </div>
      </div>
    )
  }

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
        <Tooltip content={customTooltip} />
        <Legend />
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

