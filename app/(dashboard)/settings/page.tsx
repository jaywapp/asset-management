'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Building2 } from 'lucide-react'

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountForm, setAccountForm] = useState({ name: '', type: 'stock', institution: '' })
  const [holdingForm, setHoldingForm] = useState({
    accountId: '', ticker: '', name: '', quantity: '', avgPrice: '', currentPrice: '',
  })
  const [realEstateForm, setRealEstateForm] = useState({
    name: '', address: '', purchasePrice: '', currentValue: '',
    purchaseDate: '', monthlyRentalIncome: '0',
  })

  async function loadAccounts() {
    const res = await fetch('/api/portfolio/accounts')
    if (res.ok) setAccounts(await res.json())
  }

  useEffect(() => { loadAccounts() }, [])

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/portfolio/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountForm),
    })
    setAccountForm({ name: '', type: 'stock', institution: '' })
    loadAccounts()
  }

  async function addHolding(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/portfolio/holdings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdingForm),
    })
    setHoldingForm({ accountId: '', ticker: '', name: '', quantity: '', avgPrice: '', currentPrice: '' })
    alert('종목이 추가되었습니다.')
  }

  async function addRealEstate(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/real-estate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realEstateForm),
    })
    setRealEstateForm({ name: '', address: '', purchasePrice: '', currentValue: '', purchaseDate: '', monthlyRentalIncome: '0' })
    alert('부동산이 추가되었습니다.')
  }

  const ACCOUNT_TYPES: Record<string, string> = {
    stock: '주식', fund: '펀드', deposit: '예금/적금', crypto: '가상화폐', saving: '저축',
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">설정</h1>

      <Tabs defaultValue="accounts">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="accounts">계좌 관리</TabsTrigger>
          <TabsTrigger value="holdings">종목 추가</TabsTrigger>
          <TabsTrigger value="realestate">부동산 추가</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus size={16} />계좌 추가</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addAccount} className="space-y-3">
                <div><Label>계좌명</Label>
                  <Input value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 삼성증권 CMA" required />
                </div>
                <div><Label>유형</Label>
                  <Select value={accountForm.type} onValueChange={v => setAccountForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>금융기관</Label>
                  <Input value={accountForm.institution} onChange={e => setAccountForm(p => ({ ...p, institution: e.target.value }))} placeholder="예: 삼성증권" />
                </div>
                <Button type="submit" size="sm">계좌 추가</Button>
              </form>
            </CardContent>
          </Card>

          {accounts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">등록된 계좌 ({accounts.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {accounts.map(a => (
                  <div key={a.id} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                    <div>
                      <span className="font-medium">{a.name}</span>
                      <span className="text-gray-400 ml-2">{a.institution}</span>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{ACCOUNT_TYPES[a.type] ?? a.type}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="holdings" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">종목 추가</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addHolding} className="space-y-3">
                <div><Label>계좌 선택</Label>
                  <Select value={holdingForm.accountId} onValueChange={v => setHoldingForm(p => ({ ...p, accountId: v }))}>
                    <SelectTrigger><SelectValue placeholder="계좌 선택" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>티커 (예: 005930)</Label>
                    <Input value={holdingForm.ticker} onChange={e => setHoldingForm(p => ({ ...p, ticker: e.target.value }))} required />
                  </div>
                  <div><Label>종목명</Label>
                    <Input value={holdingForm.name} onChange={e => setHoldingForm(p => ({ ...p, name: e.target.value }))} placeholder="삼성전자" required />
                  </div>
                  <div><Label>수량</Label>
                    <Input type="number" step="any" value={holdingForm.quantity} onChange={e => setHoldingForm(p => ({ ...p, quantity: e.target.value }))} required />
                  </div>
                  <div><Label>평균단가 (원)</Label>
                    <Input type="number" value={holdingForm.avgPrice} onChange={e => setHoldingForm(p => ({ ...p, avgPrice: e.target.value }))} required />
                  </div>
                  <div className="col-span-2"><Label>현재가 (원)</Label>
                    <Input type="number" value={holdingForm.currentPrice} onChange={e => setHoldingForm(p => ({ ...p, currentPrice: e.target.value }))} required />
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={!holdingForm.accountId}>종목 추가</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="realestate" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 size={16} />부동산 추가</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addRealEstate} className="space-y-3">
                <div><Label>이름 (예: 서울 아파트)</Label>
                  <Input value={realEstateForm.name} onChange={e => setRealEstateForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div><Label>주소</Label>
                  <Input value={realEstateForm.address} onChange={e => setRealEstateForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>매입가 (원)</Label>
                    <Input type="number" value={realEstateForm.purchasePrice} onChange={e => setRealEstateForm(p => ({ ...p, purchasePrice: e.target.value }))} required />
                  </div>
                  <div><Label>현재 시세 (원)</Label>
                    <Input type="number" value={realEstateForm.currentValue} onChange={e => setRealEstateForm(p => ({ ...p, currentValue: e.target.value }))} required />
                  </div>
                  <div><Label>매입일</Label>
                    <Input type="date" value={realEstateForm.purchaseDate} onChange={e => setRealEstateForm(p => ({ ...p, purchaseDate: e.target.value }))} required />
                  </div>
                  <div><Label>월 임대수입 (원)</Label>
                    <Input type="number" value={realEstateForm.monthlyRentalIncome} onChange={e => setRealEstateForm(p => ({ ...p, monthlyRentalIncome: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" size="sm">부동산 추가</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
