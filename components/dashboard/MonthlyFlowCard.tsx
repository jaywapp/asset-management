import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

interface Props { income: number; expenses: number; savings: number }

export function MonthlyFlowCard({ income, expenses, savings }: Props) {
  const savingsRate = income > 0 ? (savings / income) * 100 : 0
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-500">이번달 재무흐름</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">수입</span>
          <span className="text-green-600 font-medium">{fmt(income)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">지출</span>
          <span className="text-red-500 font-medium">{fmt(expenses)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-semibold text-sm">
          <span>순저축</span>
          <span className={savings >= 0 ? 'text-blue-600' : 'text-red-600'}>{fmt(savings)}</span>
        </div>
        {income > 0 && (
          <p className="text-xs text-gray-400">저축률 {savingsRate.toFixed(1)}%</p>
        )}
      </CardContent>
    </Card>
  )
}
