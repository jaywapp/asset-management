import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  netWorth: number
  portfolioValue: number
  realEstateValue: number
  gainLossPct: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export function NetWorthCard({ netWorth, portfolioValue, realEstateValue, gainLossPct }: Props) {
  const isUp = gainLossPct >= 0
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-500">순자산</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-gray-900">{fmt(netWorth)}</p>
        <div className="flex items-center gap-1 mt-1">
          {isUp
            ? <TrendingUp size={14} className="text-green-500" />
            : <TrendingDown size={14} className="text-red-500" />}
          <span className={`text-sm font-medium ${isUp ? 'text-green-600' : 'text-red-600'}`}>
            포트폴리오 {isUp ? '+' : ''}{gainLossPct.toFixed(2)}%
          </span>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span>금융 {fmt(portfolioValue)}</span>
          <span>부동산 {fmt(realEstateValue)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
