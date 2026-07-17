'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreditCard, Building2, Trash2, Star, Link2, Info } from 'lucide-react'
import { BankBalanceEditor, type BankFinancials } from '@/components/accounts/BankBalanceEditor'
import { LiabilitiesSection } from '@/components/accounts/LiabilitiesSection'

const TYPE_LABELS: Record<string, string> = {
  credit_card: '신용카드',
  debit_card: '체크카드',
  bank: '은행 계좌',
}
const OWNER_LABELS: Record<string, string> = {
  husband: '남편',
  wife: '아내',
  joint: '공동',
}

interface PaymentMethod {
  id: string
  name: string
  type: 'bank' | 'credit_card' | 'debit_card'
  institution: string
  owner: string
  isHub: boolean
  isShared: boolean
  color: string | null
  linkedBankId: string | null
  balance: string
  currency: string
  exchangeRateToKrw: string
  includeInNetWorth: boolean
}

interface MethodCardProps {
  m: PaymentMethod
  banks: PaymentMethod[]
  onSetHub: (id: string) => void
  onSetLinkedBank: (cardId: string, bankId: string | null) => void
  onDelete: (id: string, name: string) => void
  onFinancialsSaved: (id: string, values: BankFinancials) => void
}

function MethodCard({ m, banks, onSetHub, onSetLinkedBank, onDelete, onFinancialsSaved }: MethodCardProps) {
  const isCardType = m.type === 'credit_card' || m.type === 'debit_card'
  const linkedBank = banks.find(b => b.id === m.linkedBankId)
  return (
    <div className="flex items-start justify-between border rounded-lg p-3 gap-2 bg-white">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: (m.color ?? '#9ca3af') + '20' }}>
          {isCardType
            ? <CreditCard size={15} style={{ color: m.color ?? '#9ca3af' }} />
            : <Building2 size={15} style={{ color: m.color ?? '#9ca3af' }} />
          }
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm">{m.name}</span>
            {m.isHub && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
                <Star size={9} />허브
              </span>
            )}
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {TYPE_LABELS[m.type] ?? m.type}
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
              {OWNER_LABELS[m.owner] ?? m.owner}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{m.institution}</p>
          {isCardType && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Link2 size={11} className="text-gray-400 shrink-0" />
              <select
                value={m.linkedBankId ?? ''}
                onChange={e => onSetLinkedBank(m.id, e.target.value || null)}
                className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-600 h-6"
              >
                <option value="">결제 통장 미연결</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {linkedBank && (
                <span className="text-xs text-blue-500">→ {linkedBank.name}</span>
              )}
            </div>
          )}
          {m.type === 'bank' && (
            <BankBalanceEditor
              paymentMethodId={m.id}
              balance={m.balance}
              currency={m.currency}
              exchangeRateToKrw={m.exchangeRateToKrw}
              includeInNetWorth={m.includeInNetWorth}
              onSaved={(values) => onFinancialsSaved(m.id, values)}
            />
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {!m.isHub && m.type === 'bank' && (
          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => onSetHub(m.id)}>
            <Star size={11} className="mr-1" />허브
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-50"
          onClick={() => onDelete(m.id, m.name)}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  )
}

const emptyForm = {
  name: '',
  type: 'bank' as PaymentMethod['type'],
  institution: '',
  owner: 'joint',
  isShared: true,
  color: '#3b82f6',
  linkedBankId: 'none',
  balance: '',
  currency: 'KRW',
  exchangeRateToKrw: '1',
  includeInNetWorth: true,
}

export default function AccountsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const res = await fetch('/api/payment-methods')
    if (res.ok) setMethods(await res.json())
  }

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/payment-methods', { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<PaymentMethod[]> : Promise.reject())
      .then(setMethods)
      .catch(() => { if (!controller.signal.aborted) setMessage('계좌 정보를 불러오지 못했습니다.') })
    return () => controller.abort()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const isCard = form.type === 'credit_card' || form.type === 'debit_card'
    setMessage('')
    const response = await fetch('/api/payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        institution: form.institution,
        owner: form.owner,
        isShared: form.isShared,
        color: form.color,
        linkedBankId: isCard && form.linkedBankId !== 'none' ? form.linkedBankId : null,
        balance: form.balance || '0',
        currency: form.currency,
        exchangeRateToKrw: form.exchangeRateToKrw,
        includeInNetWorth: form.includeInNetWorth,
      }),
    })
    if (!response.ok) {
      setSaving(false)
      setMessage('입력값을 확인해 주세요.')
      return
    }
    setForm({ ...emptyForm })
    await load()
    setSaving(false)
    setMessage('계좌 또는 카드를 추가했습니다.')
  }

  async function setHub(id: string) {
    await fetch(`/api/payment-methods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHub: true }),
    })
    load()
  }

  async function setLinkedBank(cardId: string, bankId: string | null) {
    await fetch(`/api/payment-methods/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedBankId: bankId }),
    })
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}"을(를) 삭제할까요? 이 계좌로 기록된 거래 내역은 유지됩니다.`)) return
    await fetch(`/api/payment-methods/${id}`, { method: 'DELETE' })
    load()
  }

  function updateFinancials(id: string, values: BankFinancials) {
    setMethods((current) => current.map((method) => method.id === id ? { ...method, ...values } : method))
  }

  const banks = methods.filter(m => m.type === 'bank')
  const cards = methods.filter(m => m.type === 'credit_card' || m.type === 'debit_card')
  const isCard = form.type === 'credit_card' || form.type === 'debit_card'

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">계좌·카드 관리</h1>
      </div>

      <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>계좌 간 이체는 지출로 집계되지 않습니다. 카드에 결제 통장을 연결하면 선입금 이체 기능을 사용할 수 있습니다.</span>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
          <Building2 size={14} />은행 계좌 ({banks.length})
        </h2>
        {banks.length === 0
          ? <p className="text-sm text-gray-400 py-2">등록된 계좌가 없습니다.</p>
          : <div className="grid gap-2">{banks.map(m => (
              <MethodCard key={m.id} m={m} banks={banks}
                onSetHub={setHub} onSetLinkedBank={setLinkedBank} onDelete={handleDelete}
                onFinancialsSaved={updateFinancials} />
            ))}</div>
        }
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
          <CreditCard size={14} />카드 ({cards.length})
        </h2>
        {cards.length === 0
          ? <p className="text-sm text-gray-400 py-2">등록된 카드가 없습니다.</p>
          : <div className="grid gap-2">{cards.map(m => (
              <MethodCard key={m.id} m={m} banks={banks}
                onSetHub={setHub} onSetLinkedBank={setLinkedBank} onDelete={handleDelete}
                onFinancialsSaved={updateFinancials} />
            ))}</div>
        }
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">계좌·카드 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            <div>
              <Label>이름</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 신한 주거래 통장" required />
            </div>
            <div>
              <Label>금융기관</Label>
              <Input value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))}
                placeholder="예: 신한은행" required />
            </div>
            <div>
              <Label>종류</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as PaymentMethod['type'], linkedBankId: 'none' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">은행 계좌</SelectItem>
                  <SelectItem value="credit_card">신용카드</SelectItem>
                  <SelectItem value="debit_card">체크카드</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>소유자</Label>
              <Select value={form.owner} onValueChange={v => setForm(p => ({ ...p, owner: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="husband">남편</SelectItem>
                  <SelectItem value="wife">아내</SelectItem>
                  <SelectItem value="joint">공동</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isCard && banks.length > 0 && (
              <div className="col-span-2">
                <Label>결제 통장 연결 (선택)</Label>
                <Select value={form.linkedBankId} onValueChange={v => setForm(p => ({ ...p, linkedBankId: v }))}>
                  <SelectTrigger><SelectValue placeholder="나중에 연결해도 됩니다" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">연결 안 함</SelectItem>
                    {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isCard && (
              <>
                <div>
                  <Label>현재 잔액</Label>
                  <Input type="number" min="0" step="0.01" value={form.balance}
                    onChange={e => setForm(p => ({ ...p, balance: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label>통화</Label>
                  <Input maxLength={3} value={form.currency}
                    onChange={e => setForm(p => ({ ...p, currency: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <Label>원화 환율</Label>
                  <Input type="number" min="0.000001" step="0.000001" value={form.exchangeRateToKrw}
                    onChange={e => setForm(p => ({ ...p, exchangeRateToKrw: e.target.value }))} />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.includeInNetWorth}
                    onChange={e => setForm(p => ({ ...p, includeInNetWorth: e.target.checked }))} />
                  순자산에 포함
                </label>
              </>
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label>색상</Label>
                <Input type="color" value={form.color}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="h-9 px-2" />
              </div>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? '추가 중...' : '추가'}
              </Button>
            </div>
          </form>
          {message && <p className="mt-3 text-sm text-gray-500" role="status">{message}</p>}
        </CardContent>
      </Card>

      <LiabilitiesSection />
    </div>
  )
}
