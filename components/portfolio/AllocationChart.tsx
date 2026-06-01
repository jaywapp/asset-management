'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface Props { data: { name: string; value: number }[] }

const fmt = (v: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(v)

export function AllocationChart({ data }: Props) {
  if (!data.length || data.every(d => d.value === 0)) {
    return <p className="text-sm text-gray-400 py-8 text-center">자산 데이터가 없습니다.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={65} outerRadius={105}
          dataKey="value" nameKey="name" paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => [fmt(Number(v)), '평가금액']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
