'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface MonthData { month: string; income: number; expenses: number }

const fmtCompact = (v: number) =>
  new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(v)
const fmtFull = (v: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(v)

export function CashFlowChart({ data }: { data: MonthData[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v, name) => [fmtFull(Number(v)), name === 'income' ? '수입' : '지출']} />
        <Legend formatter={(v) => v === 'income' ? '수입' : '지출'} />
        <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
