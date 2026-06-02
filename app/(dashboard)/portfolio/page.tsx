'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HoldingsTable } from '@/components/portfolio/HoldingsTable'
import { AllocationChart } from '@/components/portfolio/AllocationChart'

interface Holding {
  id: string; ticker: string; name: string
  quantity: string; avgPrice: string; currentPrice: string
  accountId: string
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])

  useEffect(() => {
    fetch('/api/portfolio/holdings').then(r => r.json()).then(setHoldings)
  }, [])

  const totalValue = holdings.reduce((s, h) => s + Number(h.quantity) * Number(h.currentPrice), 0)
  const totalCost = holdings.reduce((s, h) => s + Number(h.quantity) * Number(h.avgPrice), 0)
  const totalGainLoss = totalValue - totalCost
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0

  const allocationData = Object.entries(
    holdings.reduce((acc: Record<string, number>, h) => {
      const key = h.ticker.includes('.') ? '해외주식' : '국내주식'
      acc[key] = (acc[key] ?? 0) + Number(h.quantity) * Number(h.currentPrice)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  const fmt = (n: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">포트폴리오</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">총 평가금액</p>
            <p className="text-xl font-bold text-gray-900">{fmt(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">총 수익금</p>
            <p className={`text-xl font-bold ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {totalGainLoss >= 0 ? '+' : ''}{fmt(totalGainLoss)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">총 수익률</p>
            <p className={`text-xl font-bold ${totalGainLossPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {totalGainLossPct >= 0 ? '+' : ''}{totalGainLossPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>자산배분</CardTitle></CardHeader>
          <CardContent><AllocationChart data={allocationData} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>보유 종목</CardTitle></CardHeader>
        <CardContent><HoldingsTable holdings={holdings} /></CardContent>
      </Card>
    </div>
  )
}
