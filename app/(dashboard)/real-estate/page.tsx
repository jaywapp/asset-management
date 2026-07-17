'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, X } from 'lucide-react'

interface Property {
  id: string; name: string; address: string
  purchasePrice: string; currentValue: string; purchaseDate: string
  monthlyRentalIncome: string; propertyTax: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export default function RealEstatePage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', address: '', purchasePrice: '', currentValue: '',
    purchaseDate: '', monthlyRentalIncome: '0',
  })

  async function load() {
    const res = await fetch('/api/real-estate')
    if (res.ok) setProperties(await res.json())
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/real-estate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', address: '', purchasePrice: '', currentValue: '', purchaseDate: '', monthlyRentalIncome: '0' })
    setShowForm(false)
    await load()
  }

  const totalValue = properties.reduce((s, p) => s + Number(p.currentValue), 0)
  const totalRental = properties.reduce((s, p) => s + Number(p.monthlyRentalIncome), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">부동산</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} className="mr-1" />부동산 추가
        </Button>
      </div>

      {/* 부동산 추가 폼 */}
      {showForm && (
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">부동산 추가</CardTitle>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div><Label>이름</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="예: 서울 아파트" required />
              </div>
              <div><Label>주소</Label>
                <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="예: 서울시 강남구" />
              </div>
              <div><Label>매입가 (원)</Label>
                <Input type="number" value={form.purchasePrice}
                  onChange={e => setForm(p => ({ ...p, purchasePrice: e.target.value }))} required />
              </div>
              <div><Label>현재 시세 (원)</Label>
                <Input type="number" value={form.currentValue}
                  onChange={e => setForm(p => ({ ...p, currentValue: e.target.value }))} required />
              </div>
              <div><Label>매입일</Label>
                <Input type="date" value={form.purchaseDate}
                  onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} required />
              </div>
              <div><Label>월 임대수입 (원)</Label>
                <Input type="number" value={form.monthlyRentalIncome}
                  onChange={e => setForm(p => ({ ...p, monthlyRentalIncome: e.target.value }))} />
              </div>
              <div className="col-span-2"><Button type="submit" size="sm">추가</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">총 부동산 가치</p>
          <p className="text-xl font-bold text-gray-900">{fmt(totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">월 임대수입</p>
          <p className="text-xl font-bold text-green-600">{fmt(totalRental)}</p>
        </CardContent></Card>
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            부동산이 없습니다. 위의 버튼으로 추가하세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map(p => {
            const gain = Number(p.currentValue) - Number(p.purchasePrice)
            const gainPct = Number(p.purchasePrice) > 0 ? (gain / Number(p.purchasePrice)) * 100 : 0
            const yearsHeld = (new Date().getFullYear() - new Date(p.purchaseDate).getFullYear())
            const annualYield = Number(p.currentValue) > 0
              ? (Number(p.monthlyRentalIncome) * 12 / Number(p.currentValue)) * 100 : 0

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
                        <span>{annualYield.toFixed(2)}%</span>
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
