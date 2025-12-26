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

interface MonthlyCapacityReducingData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface ProductivityCapacityReducingChartProps {
  data: MonthlyCapacityReducingData[]
}

export function ProductivityCapacityReducingChart({ data }: ProductivityCapacityReducingChartProps) {
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
    const currentYearValue = monthIndex < 6 ? currentFYStartYear : currentFYEndYear
    const lastYearValue = monthIndex < 6 ? lastFYStartYear : lastFYEndYear

    // Format month abbreviation (first 3 letters)
    const monthAbbr = label.substring(0, 3)

    const currentYearPayload = payload.find((p: any) => p.dataKey === 'Current Year')
    const lastYearPayload = payload.find((p: any) => p.dataKey === 'Last Year')
    
    const currentYearHours = currentYearPayload?.value || 0
    const lastYearHours = lastYearPayload?.value || 0

    const formatHours = (hours: number) => {
      if (hours === 0) return '-'
      return Math.round(hours).toLocaleString('en-US')
    }

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <div className="text-sm font-medium flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: currentYearPayload?.color || '#ef4444' }}
          />
          <span>
            {monthAbbr} {currentYearValue}: {formatHours(currentYearHours)}
          </span>
        </div>
        <div className="text-sm font-medium flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: lastYearPayload?.color || '#9ca3af' }}
          />
          <span>
            {monthAbbr} {lastYearValue}: {formatHours(lastYearHours)}
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
          fill="#ef4444" 
          name="Current Year"
          radius={[4, 4, 0, 0]}
        >
          <LabelList 
            dataKey="Current Year" 
            position="top"
            formatter={(value: number) => {
              if (value === 0) return ''
              // Show full hours without decimal places, with comma separator
              return Math.round(value).toLocaleString('en-US')
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
              // Show full hours without decimal places, with comma separator
              return Math.round(value).toLocaleString('en-US')
            }}
            style={{ fontSize: '11px', fill: '#666' }}
          />
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

