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

interface BarChartProps {
  data: any[]
  dataKey: string
  name: string
  xAxisKey?: string
  fillColor?: string
}

export function BarChart({
  data,
  dataKey,
  name,
  xAxisKey = 'name',
  fillColor = '#8884d8',
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey={dataKey} name={name} fill={fillColor} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

