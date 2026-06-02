'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HoldingsTable } from '@/components/portfolio/HoldingsTable'
import { AllocationChart } from '@/components/portfolio/AllocationChart'
import { ImageAnalyzer } from '@/components/ui/image-analyzer'
import { Plus, X, Camera } from 'lucide-react'

interface Holding {
  id: string; ticker: string; name: string
  quantity: string; avgPrice: string; currentPrice: string; accountId: string
}
interface Account { id: string; name: string; type: string }

const ACCOUNT_TYPES: Record<string, string> = {
  stock: '주식', fund: '펀드', deposit: '예금/적금', crypto: '가상화폐', saving: '저축',
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState<'holding' | 'account' | 'image' | null>(null)
  const [pendingHoldings, setPendingHoldings] = useState<Record<string, unknown>[]>([])
  const [pendingAccountId, setPendingAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  const [accountForm, setAccountForm] = useState({ name: '', type: 'stock', institution: '' })
  const [holdingForm, setHoldingForm] = useState({
    accountId: '', ticker: '', name: '', quantity: '', avgPrice: '', currentPrice: '',
  })

  async function load() {
    const [h, a] = await Promise.all([
      fetch('/api/portfolio/holdings').then(r => r.json()),
      fetch('/api/portfolio/accounts').then(r => r.json()),
    ])
    setHoldings(h)
    setAccounts(a)
  }

  useEffect(() => { load() }, [])

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/portfolio/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountForm),
    })
    setAccountForm({ name: '', type: 'stock', institution: '' })
    setShowForm(null)
    await load()
  }

  async function addHolding(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/portfolio/holdings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdingForm),
    })
    setHoldingForm({ accountId: '', ticker: '', name: '', quantity: '', avgPrice: '', currentPrice: '' })
    setShowForm(null)
    await load()
  }

  async function savePendingHoldings() {
    if (!pendingAccountId) return
    setSaving(true)
    for (const h of pendingHoldings) {
      await fetch('/api/portfolio/holdings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: pendingAccountId,
          ticker: String(h.ticker ?? h.name ?? ''),
          name: String(h.name ?? ''),
          quantity: String(h.quantity ?? '0'),
          avgPrice: String(h.avgPrice ?? h.currentPrice ?? '0'),
          currentPrice: String(h.currentPrice ?? '0'),
        }),
      })
    }
    setPendingHoldings([])
    setPendingAccountId('')
    setShowForm(null)
    await load()
    setSaving(false)
  }

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">포트폴리오</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowForm(showForm === 'image' ? null : 'image')}>
            <Camera size={14} className="mr-1" />이미지 입력
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowForm(showForm === 'account' ? null : 'account')}>
            <Plus size={14} className="mr-1" />계좌 추가
          </Button>
          <Button size="sm" onClick={() => setShowForm(showForm === 'holding' ? null : 'holding')}>
            <Plus size={14} className="mr-1" />종목 추가
          </Button>
        </div>
      </div>

      {/* 이미지 분석 */}
      {showForm === 'image' && (
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera size={14} className="text-purple-500" />AI 이미지 분석
              </CardTitle>
              <button onClick={() => setShowForm(null)}><X size={16} className="text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-400">주식 보유 내역 화면, 증권 계좌 스크린샷을 업로드하세요.</p>
          </CardHeader>
          <CardContent>
            <ImageAnalyzer
              context="portfolio"
              onResult={(entries) => { setPendingHoldings(entries); setShowForm(null) }}
              label="보유 종목 화면 업로드"
            />
          </CardContent>
        </Card>
      )}

      {/* AI 분석 결과 확인 */}
      {pendingHoldings.length > 0 && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700">
              AI 분석 결과 ({pendingHoldings.length}종목) — 저장할 계좌를 선택하세요
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-1">종목</th>
                  <th className="text-right pb-1">수량</th>
                  <th className="text-right pb-1">평균단가</th>
                  <th className="text-right pb-1">현재가</th>
                </tr></thead>
                <tbody>{pendingHoldings.map((h, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5">
                      <div className="font-medium">{String(h.ticker ?? '')}</div>
                      <div className="text-xs text-gray-400">{String(h.name ?? '')}</div>
                    </td>
                    <td className="text-right">{String(h.quantity ?? 0)}</td>
                    <td className="text-right">{fmt(Number(h.avgPrice ?? 0))}</td>
                    <td className="text-right">{fmt(Number(h.currentPrice ?? 0))}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs">저장할 계좌</Label>
                {accounts.length === 0
                  ? <p className="text-xs text-gray-400 mt-1">먼저 계좌를 추가해주세요.</p>
                  : <Select value={pendingAccountId} onValueChange={setPendingAccountId}>
                      <SelectTrigger><SelectValue placeholder="계좌 선택" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                }
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={savePendingHoldings}
                  disabled={!pendingAccountId || saving}
                  className="bg-green-600 hover:bg-green-700">
                  {saving ? '저장 중...' : '저장'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingHoldings([])}>취소</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 계좌 추가 폼 */}
      {showForm === 'account' && (
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">계좌 추가</CardTitle>
              <button onClick={() => setShowForm(null)}><X size={16} className="text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={addAccount} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>계좌명</Label>
                <Input value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="예: 삼성증권 주식" required />
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
                <Input value={accountForm.institution} onChange={e => setAccountForm(p => ({ ...p, institution: e.target.value }))}
                  placeholder="예: 삼성증권" />
              </div>
              <div className="sm:col-span-3"><Button type="submit" size="sm">추가</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 종목 추가 폼 */}
      {showForm === 'holding' && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">종목 추가</CardTitle>
              <button onClick={() => setShowForm(null)}><X size={16} className="text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-sm text-gray-400">먼저 계좌를 추가해주세요.</p>
            ) : (
              <form onSubmit={addHolding} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-3"><Label>계좌</Label>
                  <Select value={holdingForm.accountId} onValueChange={v => setHoldingForm(p => ({ ...p, accountId: v }))}>
                    <SelectTrigger><SelectValue placeholder="계좌 선택" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>티커</Label>
                  <Input value={holdingForm.ticker} onChange={e => setHoldingForm(p => ({ ...p, ticker: e.target.value }))}
                    placeholder="005930" required />
                </div>
                <div><Label>종목명</Label>
                  <Input value={holdingForm.name} onChange={e => setHoldingForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="삼성전자" required />
                </div>
                <div><Label>수량</Label>
                  <Input type="number" step="any" value={holdingForm.quantity}
                    onChange={e => setHoldingForm(p => ({ ...p, quantity: e.target.value }))} required />
                </div>
                <div><Label>평균단가</Label>
                  <Input type="number" value={holdingForm.avgPrice}
                    onChange={e => setHoldingForm(p => ({ ...p, avgPrice: e.target.value }))} required />
                </div>
                <div><Label>현재가</Label>
                  <Input type="number" value={holdingForm.currentPrice}
                    onChange={e => setHoldingForm(p => ({ ...p, currentPrice: e.target.value }))} required />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <Button type="submit" size="sm" disabled={!holdingForm.accountId}>추가</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">총 평가금액</p>
          <p className="text-xl font-bold text-gray-900">{fmt(totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">총 수익금</p>
          <p className={`text-xl font-bold ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totalGainLoss >= 0 ? '+' : ''}{fmt(totalGainLoss)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">총 수익률</p>
          <p className={`text-xl font-bold ${totalGainLossPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totalGainLossPct >= 0 ? '+' : ''}{totalGainLossPct.toFixed(2)}%
          </p>
        </CardContent></Card>
      </div>

      {allocationData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>자산배분</CardTitle></CardHeader>
            <CardContent><AllocationChart data={allocationData} /></CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>보유 종목 ({holdings.length})</CardTitle></CardHeader>
        <CardContent><HoldingsTable holdings={holdings} /></CardContent>
      </Card>
    </div>
  )
}
