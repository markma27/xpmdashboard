'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts'

interface MonthlyRevenueData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface RevenueMonthlyChartProps {
  data: MonthlyRevenueData[]
  selectedMonth?: string | null
  onMonthClick?: (month: string | null) => void
}

export function RevenueMonthlyChart({ data, selectedMonth, onMonthClick }: RevenueMonthlyChartProps) {
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
            style={{ backgroundColor: currentYearPayload?.color || '#fca5a5' }}
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

  const handleBarClick = (data: any) => {
    if (onMonthClick && data && data.activePayload && data.activePayload.length > 0) {
      const clickedMonth = data.activePayload[0].payload.month
      if (clickedMonth) {
        // Toggle: if clicking the same month, deselect it
        if (selectedMonth === clickedMonth) {
          onMonthClick(null)
        } else {
          onMonthClick(clickedMonth)
        }
      }
    }
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RechartsBarChart
        data={data}
        margin={{ top: 30, right: 30, left: 5, bottom: 10 }}
        onClick={handleBarClick}
      >
        <XAxis 
          dataKey="month" 
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
          cursor="pointer"
          barSize={40}
        >
          {data.map((entry, index) => {
            const isSelected = selectedMonth === entry.month
            return (
              <Cell 
                key={`cell-current-${index}`} 
                fill={isSelected ? '#dc2626' : '#fca5a5'}
              />
            )
          })}
          <LabelList 
            dataKey="Current Year" 
            position="top"
            formatter={(value: number) => {
              if (value === 0) return ''
              // Show full amount if less than $10k, otherwise use 'k' notation
              if (value < 10000) {
                return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              }
              return `$${(value / 1000).toFixed(0)}k`
            }}
            style={{ fontSize: '9px', fill: '#475569', fontWeight: 600 }}
          />
        </Bar>
        <Bar 
          dataKey="Last Year" 
          fill="#cbd5e1" 
          name="Last Year"
          radius={[3, 3, 0, 0]}
          cursor="pointer"
          barSize={40}
        >
          {data.map((entry, index) => {
            const isSelected = selectedMonth === entry.month
            return (
              <Cell 
                key={`cell-last-${index}`} 
                fill={isSelected ? '#64748b' : '#cbd5e1'}
              />
            )
          })}
          <LabelList 
            dataKey="Last Year" 
            position="top"
            formatter={(value: number) => {
              if (value === 0) return ''
              // Show full amount if less than $10k, otherwise use 'k' notation
              if (value < 10000) {
                return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              }
              return `$${(value / 1000).toFixed(0)}k`
            }}
            style={{ fontSize: '9px', fill: '#64748b', fontWeight: 600 }}
          />
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

