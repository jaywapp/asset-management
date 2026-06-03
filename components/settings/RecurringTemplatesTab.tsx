'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Plus, Trash2 } from 'lucide-react'

const CAT_LABELS: Record<string, string> = {
  food: '식비', transport: '교통', housing: '주거', medical: '의료',
  education: '교육', leisure: '여가', subscription: '구독', other: '기타',
}
const EXPENSE_CATS = ['food', 'transport', 'housing', 'medical', 'education', 'leisure', 'subscription', 'other']

interface Template {
  id: string
  category: string
  description: string
  paymentMethodId: string | null
  amountType: 'fixed' | 'variable'
  estimatedAmount: string | null
  fixedAmount: string | null
  dayOfMonth: number | null
  isActive: boolean
}

interface Props {
  paymentMethods: { id: string; name: string }[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export function RecurringTemplatesTab({ paymentMethods }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [form, setForm] = useState({
    description: '',
    category: 'subscription',
    amountType: 'fixed' as 'fixed' | 'variable',
    fixedAmount: '',
    estimatedAmount: '',
    paymentMethodId: '',
    dayOfMonth: '',
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/recurring-templates')
    if (res.ok) setTemplates(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/recurring-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: form.description,
        category: form.category,
        amountType: form.amountType,
        fixedAmount: form.amountType === 'fixed' && form.fixedAmount ? form.fixedAmount : null,
        estimatedAmount: form.amountType === 'variable' && form.estimatedAmount ? form.estimatedAmount : null,
        paymentMethodId: form.paymentMethodId || null,
        dayOfMonth: form.dayOfMonth ? parseInt(form.dayOfMonth) : null,
      }),
    })
    setForm({ description: '', category: 'subscription', amountType: 'fixed', fixedAmount: '', estimatedAmount: '', paymentMethodId: '', dayOfMonth: '' })
    await load()
    setSaving(false)
  }

  async function toggleActive(tmpl: Template) {
    await fetch(`/api/recurring-templates/${tmpl.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !tmpl.isActive }),
    })
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('이 반복 지출 템플릿을 삭제할까요?')) return
    await fetch(`/api/recurring-templates/${id}`, { method: 'DELETE' })
    await load()
  }

  const methodName = (id: string | null) =>
    id ? (paymentMethods.find(m => m.id === id)?.name ?? id) : '-'

  return (
    <div className="space-y-4">
      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw size={14} className="text-orange-500" />
              반복 지출 목록 ({templates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{tmpl.description}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {CAT_LABELS[tmpl.category] ?? tmpl.category}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      tmpl.amountType === 'fixed'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {tmpl.amountType === 'fixed' ? '고정' : '변동'}
                    </span>
                    {!tmpl.isActive && (
                      <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">비활성</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                    {tmpl.amountType === 'fixed' && tmpl.fixedAmount && (
                      <span>{fmt(Number(tmpl.fixedAmount))}</span>
                    )}
                    {tmpl.amountType === 'variable' && tmpl.estimatedAmount && (
                      <span>예상 {fmt(Number(tmpl.estimatedAmount))}</span>
                    )}
                    {tmpl.paymentMethodId && <span>{methodName(tmpl.paymentMethodId)}</span>}
                    {tmpl.dayOfMonth && <span>매월 {tmpl.dayOfMonth}일</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(tmpl)}
                    className={`text-xs h-7 px-2 ${tmpl.isActive ? 'text-gray-400' : 'text-orange-500'}`}>
                    {tmpl.isActive ? '비활성화' : '활성화'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(tmpl.id)}
                    className="text-xs h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus size={14} />반복 지출 추가
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <Label>항목명</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="예: 넷플릭스, 관리비" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>카테고리</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATS.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>금액 유형</Label>
                <Select value={form.amountType} onValueChange={v => setForm(p => ({ ...p, amountType: v as 'fixed' | 'variable' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">고정 (매달 동일)</SelectItem>
                    <SelectItem value="variable">변동 (매달 다름)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.amountType === 'fixed' ? (
                <div>
                  <Label>고정 금액 (원)</Label>
                  <Input type="number" value={form.fixedAmount}
                    onChange={e => setForm(p => ({ ...p, fixedAmount: e.target.value }))}
                    placeholder="17900" required />
                </div>
              ) : (
                <div>
                  <Label>예상 금액 (원, 참고용)</Label>
                  <Input type="number" value={form.estimatedAmount}
                    onChange={e => setForm(p => ({ ...p, estimatedAmount: e.target.value }))}
                    placeholder="150000" />
                </div>
              )}
              <div>
                <Label>결제일 (선택)</Label>
                <Input type="number" min="1" max="31" value={form.dayOfMonth}
                  onChange={e => setForm(p => ({ ...p, dayOfMonth: e.target.value }))}
                  placeholder="25" />
              </div>
            </div>
            <div>
              <Label>결제수단 (선택)</Label>
              <Select value={form.paymentMethodId} onValueChange={v => setForm(p => ({ ...p, paymentMethodId: v }))}>
                <SelectTrigger><SelectValue placeholder="결제수단 선택 (선택사항)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">없음</SelectItem>
                  {paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? '추가 중...' : '반복 지출 추가'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
