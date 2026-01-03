'use client'

import { useEffect, useState } from 'react'
import { ProductivityPercentageChart } from './productivity-percentage-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from './chart-skeleton'

interface MonthlyProductivityPercentageData {
  month: string
  'Current Year': number
  'Last Year': number
}

interface ProductivityPercentageChartClientProps {
  organizationId: string
  selectedStaff?: string | null
  asOfDate?: string
}

export function ProductivityPercentageChartClient({ 
  organizationId, 
  selectedStaff,
  asOfDate
}: ProductivityPercentageChartClientProps) {
  const [data, setData] = useState<MonthlyProductivityPercentageData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        // Build query URLs with optional staff filter and date
        const baseParams = `organizationId=${organizationId}&t=${Date.now()}${asOfDate ? `&asOfDate=${asOfDate}` : ''}`
        const staffParam = selectedStaff ? `&staff=${encodeURIComponent(selectedStaff)}` : ''
        
        // Fetch billable hours, standard hours, and capacity reducing hours
        const [billableHoursResponse, standardHoursResponse, capacityReducingResponse] = await Promise.all([
          fetch(`/api/productivity/monthly?${baseParams}${staffParam}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
          fetch(`/api/productivity/standard-hours/monthly?${baseParams}${staffParam}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
          fetch(`/api/productivity/capacity-reducing/monthly?${baseParams}${staffParam}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }),
        ])
        
        if (!billableHoursResponse.ok) {
          throw new Error('Failed to fetch billable hours data')
        }
        
        if (!standardHoursResponse.ok) {
          throw new Error('Failed to fetch standard hours data')
        }
        
        if (!capacityReducingResponse.ok) {
          throw new Error('Failed to fetch capacity reducing hours data')
        }
        
        const billableHoursData = await billableHoursResponse.json()
        const standardHoursData = await standardHoursResponse.json()
        const capacityReducingData = await capacityReducingResponse.json()
        
        // Calculate productivity percentage = (billable hours / total hours) * 100
        // Total hours = standard hours - capacity reducing hours
        const percentageData = billableHoursData.map((billableItem: any, index: number) => {
          const standardHoursItem = standardHoursData[index]
          const capacityReducingItem = capacityReducingData[index]
          
          const currentYearBillable = billableItem['Current Year'] || 0
          const currentYearStandard = standardHoursItem?.['Current Year'] || 0
          const currentYearCapacityReducing = capacityReducingItem?.['Current Year'] || 0
          const currentYearTotal = Math.max(0, currentYearStandard - currentYearCapacityReducing)
          
          const lastYearBillable = billableItem['Last Year'] || 0
          const lastYearStandard = standardHoursItem?.['Last Year'] || 0
          const lastYearCapacityReducing = capacityReducingItem?.['Last Year'] || 0
          const lastYearTotal = Math.max(0, lastYearStandard - lastYearCapacityReducing)
          
          // Calculate percentage, avoid division by zero
          const currentYearPercentage = currentYearTotal > 0 
            ? (currentYearBillable / currentYearTotal) * 100 
            : 0
          const lastYearPercentage = lastYearTotal > 0 
            ? (lastYearBillable / lastYearTotal) * 100 
            : 0
          
          return {
            month: billableItem.month,
            'Current Year': Math.round(currentYearPercentage * 10) / 10, // Round to 1 decimal place
            'Last Year': Math.round(lastYearPercentage * 10) / 10,
          }
        })
        
        // Filter data: only filter Current Year data, keep Last Year data for full 12 months
        let filteredData = percentageData
        if (asOfDate) {
          const selectedDate = new Date(asOfDate)
          const selectedMonth = selectedDate.getMonth() // 0-11
          const selectedYear = selectedDate.getFullYear()
          
          // Determine financial year for the selected date
          let currentFYStartYear: number
          if (selectedMonth >= 6) {
            currentFYStartYear = selectedYear
          } else {
            currentFYStartYear = selectedYear - 1
          }
          
          // Month order: July (0), August (1), September (2), October (3), November (4), December (5),
          //              January (6), February (7), March (8), April (9), May (10), June (11)
          // Map actual month to array index
          const monthIndex = selectedMonth >= 6 ? selectedMonth - 6 : selectedMonth + 6
          
          // Filter: set Current Year to 0 for months after selected date, but keep Last Year data
          filteredData = percentageData.map((item: MonthlyProductivityPercentageData, index: number) => {
            if (index > monthIndex) {
              // After selected month: keep Last Year, set Current Year to 0
              return {
                ...item,
                'Current Year': 0,
              }
            }
            return item
          })
        }
        
        setData(filteredData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, selectedStaff, asOfDate])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Billable %</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-destructive">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Billable %</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">
              No data available. Please upload timesheet data first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <CardHeader className="py-1.5 px-3 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
        <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Monthly Billable %</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ProductivityPercentageChart data={data} />
      </CardContent>
    </Card>
  )
}

