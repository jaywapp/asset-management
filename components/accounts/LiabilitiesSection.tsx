'use client'

import { useEffect, useState } from 'react'
import { Landmark, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Liability {
  id: string
  name: string
  type: string
  institution: string | null
  balance: string
  currency: string
  exchangeRateToKrw: string
  interestRate: string | null
  monthlyPayment: string | null
}

const TYPE_LABELS: Record<string, string> = {
  mortgage: '주택담보대출',
  credit_loan: '신용대출',
  lease_loan: '전세대출',
  card: '카드 미결제금',
  other: '기타 부채',
}

const emptyForm = {
  name: '', type: 'mortgage', institution: '', balance: '', currency: 'KRW',
  exchangeRateToKrw: '1', interestRate: '', monthlyPayment: '',
}

const formatAmount = (value: string, currency: string) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value))

export function LiabilitiesSection() {
  const [items, setItems] = useState<Liability[]>([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/liabilities', { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Liability[]> : Promise.reject())
      .then(setItems)
      .catch(() => { if (!controller.signal.aborted) setMessage('부채 정보를 불러오지 못했습니다.') })
    return () => controller.abort()
  }, [])

  async function add(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const response = await fetch('/api/liabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!response.ok) {
      setMessage('입력값을 확인해 주세요.')
      return
    }
    const item = await response.json() as Liability
    setItems((current) => [...current, item])
    setForm(emptyForm)
    setMessage('부채를 등록했습니다.')
  }

  async function updateBalance(item: Liability, balance: string) {
    const response = await fetch(`/api/liabilities/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance }),
    })
    if (!response.ok) return setMessage('부채 잔액을 수정하지 못했습니다.')
    const updated = await response.json() as Liability
    setItems((current) => current.map((value) => value.id === item.id ? updated : value))
    setMessage('부채 잔액을 수정했습니다.')
  }

  async function remove(item: Liability) {
    if (!confirm(`“${item.name}”을 삭제할까요?`)) return
    const response = await fetch(`/api/liabilities/${item.id}`, { method: 'DELETE' })
    if (!response.ok) return setMessage('부채를 삭제하지 못했습니다.')
    setItems((current) => current.filter((value) => value.id !== item.id))
  }

  return (
    <section className="space-y-3" aria-labelledby="liabilities-heading">
      <div>
        <h2 id="liabilities-heading" className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
          <Landmark size={15} /> 부채 ({items.length})
        </h2>
        <p className="mt-1 text-xs text-gray-400">대출과 카드 미결제금을 등록하면 순자산에서 자동으로 차감합니다.</p>
      </div>
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs text-gray-400">{TYPE_LABELS[item.type]} · {item.institution || '금융기관 미입력'}</p>
              <p className="mt-1 text-sm font-semibold text-blue-600">{formatAmount(item.balance, item.currency)}</p>
            </div>
            <form className="flex items-end gap-2" onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              void updateBalance(item, String(data.get('balance') ?? ''))
            }}>
              <label className="text-xs text-gray-500">현재 잔액
                <Input name="balance" className="mt-1 h-8 w-36" type="number" min="0" defaultValue={item.balance} />
              </label>
              <Button type="submit" size="sm" variant="outline">수정</Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`${item.name} 삭제`} onClick={() => void remove(item)}>
                <Trash2 size={14} />
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">부채 추가</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div><Label>이름</Label><Input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="예: 주택담보대출" /></div>
            <div><Label>종류</Label><Select value={form.type} onValueChange={(type) => setForm((p) => ({ ...p, type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>금융기관</Label><Input value={form.institution} onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))} /></div>
            <div><Label>현재 잔액</Label><Input required type="number" min="0" value={form.balance} onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))} /></div>
            <div><Label>통화</Label><Input maxLength={3} value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} /></div>
            <div><Label>원화 환율</Label><Input required type="number" min="0.000001" step="0.000001" value={form.exchangeRateToKrw} onChange={(e) => setForm((p) => ({ ...p, exchangeRateToKrw: e.target.value }))} /></div>
            <div><Label>금리(%)</Label><Input type="number" min="0" step="0.0001" value={form.interestRate} onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))} /></div>
            <div><Label>월 상환액</Label><Input type="number" min="0" value={form.monthlyPayment} onChange={(e) => setForm((p) => ({ ...p, monthlyPayment: e.target.value }))} /></div>
            <div className="flex items-end"><Button className="w-full" disabled={saving}>{saving ? '등록 중…' : '부채 등록'}</Button></div>
          </form>
          {message && <p className="mt-3 text-sm text-gray-500" role="status">{message}</p>}
        </CardContent>
      </Card>
    </section>
  )
}
