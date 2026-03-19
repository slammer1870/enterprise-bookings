'use client'

/**
 * Phase 4 – Bookings over time trend chart (recharts). Supports optional previous period (dual-line).
 */
import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export type BookingsOverTimeRow = { date: string; count: number }

/** Merge current + previous by date for dual-line chart; fill 0 for missing. */
function mergeSeries(
  current: BookingsOverTimeRow[],
  previous: BookingsOverTimeRow[] | undefined,
): { date: string; count: number; countPrevious: number }[] {
  const byDate = new Map<string, { count: number; countPrevious: number }>()
  for (const row of current) {
    byDate.set(row.date, { count: row.count, countPrevious: 0 })
  }
  if (previous) {
    for (const row of previous) {
      const existing = byDate.get(row.date)
      if (existing) existing.countPrevious = row.count
      else byDate.set(row.date, { count: 0, countPrevious: row.count })
    }
  }
  const dates = Array.from(byDate.keys()).sort()
  return dates.map((date) => {
    const v = byDate.get(date)!
    return { date, count: v.count, countPrevious: v.countPrevious }
  })
}

export const BookingsTrendChart: React.FC<{
  data: BookingsOverTimeRow[]
  previousData?: BookingsOverTimeRow[]
  height?: number
}> = ({ data, previousData, height = 280 }) => {
  const chartData = useMemo(() => mergeSeries(data, previousData), [data, previousData])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-elevation-300, #eee)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => (typeof v === 'string' ? v.slice(0, 10) : String(v))}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(v) => (typeof v === 'string' ? v.slice(0, 10) : String(v))}
          contentStyle={{
            backgroundColor: 'var(--theme-elevation-50)',
            border: '1px solid var(--theme-elevation-200, #ddd)',
            borderRadius: '4px',
          }}
        />
        {previousData && previousData.length > 0 && <Legend />}
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--theme-success-500, #22c55e)"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Current period"
        />
        {previousData && previousData.length > 0 && (
          <Line
            type="monotone"
            dataKey="countPrevious"
            stroke="var(--theme-elevation-500, #737373)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 2 }}
            name="Previous period"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
