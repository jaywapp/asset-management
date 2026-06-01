'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Property {
  id: string; name: string; address: string
  purchasePrice: string; currentValue: string; purchaseDate: string
  monthlyRentalIncome: string; propertyTax: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export default function RealEstatePage() {
  const [properties, setProperties] = useState<Property[]>([])

  useEffect(() => {
    fetch('/api/real-estate').then(r => r.json()).then(setProperties)
  }, [])

  const totalValue = properties.reduce((s, p) => s + Number(p.currentValue), 0)
  const totalRental = properties.reduce((s, p) => s + Number(p.monthlyRentalIncome), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">부동산</h1>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">총 부동산 가치</p>
            <p className="text-xl font-bold text-gray-900">{fmt(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">월 임대수입</p>
            <p className="text-xl font-bold text-green-600">{fmt(totalRental)}</p>
          </CardContent>
        </Card>
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            부동산이 없습니다. 설정에서 추가하세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map(p => {
            const gain = Number(p.currentValue) - Number(p.purchasePrice)
            const gainPct = Number(p.purchasePrice) > 0
              ? (gain / Number(p.purchasePrice)) * 100
              : 0
            const yearsHeld = (Date.now() - new Date(p.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
            const annualRentalYield = totalValue > 0
              ? (Number(p.monthlyRentalIncome) * 12 / Number(p.currentValue)) * 100
              : 0

            return (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <p className="text-xs text-gray-400 mt-0.5">{p.address}</p>
                    </div>
                    <Badge variant={gain >= 0 ? 'default' : 'destructive'}>
                      {gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">현재가</span>
                    <span className="font-semibold">{fmt(Number(p.currentValue))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">매입가</span>
                    <span>{fmt(Number(p.purchasePrice))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">평가손익</span>
                    <span className={gain >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                      {gain >= 0 ? '+' : ''}{fmt(gain)}
                    </span>
                  </div>
                  {Number(p.monthlyRentalIncome) > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">월 임대수입</span>
                        <span className="text-green-600">{fmt(Number(p.monthlyRentalIncome))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">연 임대수익률</span>
                        <span>{annualRentalYield.toFixed(2)}%</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>보유기간</span>
                    <span>{yearsHeld.toFixed(1)}년</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
