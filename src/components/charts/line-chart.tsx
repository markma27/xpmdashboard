'use client'

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface LineChartProps {
  data: any[]
  dataKey: string
  name: string
  xAxisKey?: string
  strokeColor?: string
}

export function LineChart({
  data,
  dataKey,
  name,
  xAxisKey = 'name',
  strokeColor = '#8884d8',
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={strokeColor} />
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}

