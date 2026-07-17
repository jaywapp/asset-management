import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  netWorth: number
  portfolioValue: number
  realEstateValue: number
  cashBalance: number
  liabilities: number
  gainLossPct: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export function NetWorthCard({
  netWorth,
  portfolioValue,
  realEstateValue,
  cashBalance,
  liabilities,
  gainLossPct,
}: Props) {
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
            ? <TrendingUp size={14} className="text-red-500" aria-hidden="true" />
            : <TrendingDown size={14} className="text-blue-500" aria-hidden="true" />}
          <span className={`text-sm font-medium ${isUp ? 'text-red-600' : 'text-blue-600'}`}>
            포트폴리오 {isUp ? '+' : ''}{gainLossPct.toFixed(2)}%
          </span>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span>투자 {fmt(portfolioValue)}</span>
          <span>현금 {fmt(cashBalance)}</span>
          <span>부동산 {fmt(realEstateValue)}</span>
        </div>
        <p className="mt-2 text-xs text-blue-600">부채 -{fmt(liabilities)}</p>
        <p className="mt-2 text-[11px] text-gray-400">등록한 계좌·투자·부동산에서 부채를 뺀 금액입니다. 외화는 입력한 환율을 적용합니다.</p>
      </CardContent>
    </Card>
  )
}
