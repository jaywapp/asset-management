'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Building2, Bot, RotateCcw, User } from 'lucide-react'
import { PaymentMethodsTab } from '@/components/settings/PaymentMethodsTab'
import { ConversationalImport } from '@/components/import/ConversationalImport'
import { RecurringTemplatesTab } from '@/components/settings/RecurringTemplatesTab'

const AGENT_LABELS: Record<string, string> = {
  cfo: 'CFO (총괄)',
  investment: '투자분석',
  risk: '리스크 매니저',
  'real-estate': '부동산',
  budget: '재무흐름',
}

interface AgentPrompt { agentName: string; systemPrompt: string; isCustom: boolean }

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountForm, setAccountForm] = useState({ name: '', type: 'stock', institution: '' })
  const [paymentMethodsList, setPaymentMethodsList] = useState<any[]>([])
  const [prompts, setPrompts] = useState<AgentPrompt[]>([])
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)

  // 계정 설정
  const [accountInfo, setAccountInfo] = useState({ name: '', email: '', role: '' })
  const [nameForm, setNameForm] = useState('')
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [accountMsg, setAccountMsg] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
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

  async function loadAccountInfo() {
    const res = await fetch('/api/settings/account')
    if (res.ok) {
      const data = await res.json()
      setAccountInfo(data)
      setNameForm(data.name)
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingAccount(true)
    setAccountMsg('')
    const res = await fetch('/api/settings/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameForm }),
    })
    if (res.ok) {
      setAccountMsg('이름이 변경되었습니다. 다시 로그인하면 반영됩니다.')
      await loadAccountInfo()
    }
    setSavingAccount(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) {
      setAccountMsg('새 비밀번호가 일치하지 않습니다')
      return
    }
    setSavingAccount(true)
    setAccountMsg('')
    const res = await fetch('/api/settings/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    })
    const data = await res.json()
    if (res.ok) {
      setAccountMsg('비밀번호가 변경되었습니다.')
      setPwForm({ current: '', next: '', confirm: '' })
    } else {
      setAccountMsg(data.error ?? '오류가 발생했습니다')
    }
    setSavingAccount(false)
  }

  async function loadPrompts() {
    const res = await fetch('/api/settings/prompts')
    if (res.ok) setPrompts(await res.json())
  }

  useEffect(() => {
    loadAccounts()
    loadPrompts()
    loadAccountInfo()
    fetch('/api/payment-methods').then(r => r.json()).then(setPaymentMethodsList)
  }, [])

  async function savePrompt(agentName: string) {
    setSavingPrompt(true)
    await fetch('/api/settings/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName, systemPrompt: editText }),
    })
    setEditingAgent(null)
    await loadPrompts()
    setSavingPrompt(false)
  }

  async function resetPrompt(agentName: string) {
    await fetch('/api/settings/prompts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName }),
    })
    await loadPrompts()
  }

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
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="account">내 계정</TabsTrigger>
          <TabsTrigger value="accounts">계좌 관리</TabsTrigger>
          <TabsTrigger value="holdings">종목 추가</TabsTrigger>
          <TabsTrigger value="realestate">부동산</TabsTrigger>
          <TabsTrigger value="prompts">AI 지침</TabsTrigger>
          <TabsTrigger value="payment-methods">결제수단</TabsTrigger>
          <TabsTrigger value="import">가져오기</TabsTrigger>
          <TabsTrigger value="recurring">반복 지출</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><User size={16} />내 정보</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm text-gray-500">
              <p>이메일: <span className="text-gray-900 font-medium">{accountInfo.email}</span></p>
              <p>역할: <span className="text-gray-900 font-medium">{accountInfo.role === 'husband' ? '남편' : '아내'}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">이름 변경</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={saveName} className="space-y-3">
                <div>
                  <Label>이름</Label>
                  <Input value={nameForm} onChange={e => setNameForm(e.target.value)} placeholder="표시될 이름" required />
                </div>
                <Button type="submit" size="sm" disabled={savingAccount}>저장</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">비밀번호 변경</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={savePassword} className="space-y-3">
                <div>
                  <Label>현재 비밀번호</Label>
                  <Input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required />
                </div>
                <div>
                  <Label>새 비밀번호</Label>
                  <Input type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} required />
                </div>
                <div>
                  <Label>새 비밀번호 확인</Label>
                  <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required />
                </div>
                <Button type="submit" size="sm" disabled={savingAccount}>변경</Button>
              </form>
            </CardContent>
          </Card>

          {accountMsg && (
            <p className={`text-sm ${accountMsg.includes('오류') || accountMsg.includes('않습') ? 'text-red-500' : 'text-green-600'}`}>
              {accountMsg}
            </p>
          )}
        </TabsContent>

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

        <TabsContent value="prompts" className="mt-4 space-y-3">
          <p className="text-xs text-gray-500">각 AI 에이전트의 시스템 지침을 편집합니다. 빈 칸으로 저장하면 기본값으로 초기화됩니다.</p>
          {prompts.map(p => (
            <Card key={p.agentName}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bot size={14} className="text-blue-500" />
                    {AGENT_LABELS[p.agentName] ?? p.agentName}
                    {p.isCustom && <span className="text-xs text-blue-500 font-normal">(커스텀)</span>}
                  </CardTitle>
                  <div className="flex gap-1">
                    {p.isCustom && (
                      <Button variant="ghost" size="sm" onClick={() => resetPrompt(p.agentName)}
                        className="text-xs text-gray-400 h-7 px-2">
                        <RotateCcw size={12} className="mr-1" />기본값
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => { setEditingAgent(p.agentName); setEditText(p.systemPrompt) }}>
                      편집
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {editingAgent === p.agentName ? (
                <CardContent>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={5}
                    className="w-full text-sm border rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => savePrompt(p.agentName)} disabled={savingPrompt}>
                      {savingPrompt ? '저장 중...' : '저장'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingAgent(null)}>취소</Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent>
                  <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-3">{p.systemPrompt}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="payment-methods" className="mt-4">
          <PaymentMethodsTab />
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <ConversationalImport paymentMethods={paymentMethodsList} />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <RecurringTemplatesTab paymentMethods={paymentMethodsList} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
