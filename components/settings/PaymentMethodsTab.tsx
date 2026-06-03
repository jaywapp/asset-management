'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TYPE_LABELS: Record<string, string> = { credit_card: '신용카드', debit_card: '체크카드', bank: '은행' }
const OWNER_LABELS: Record<string, string> = { husband: '남편', wife: '아내', joint: '공동' }

export function PaymentMethodsTab() {
  const [methods, setMethods] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', type: 'bank', institution: '', owner: 'husband', isShared: false, color: '#3b82f6' })

  async function load() {
    const res = await fetch('/api/payment-methods')
    if (res.ok) setMethods(await res.json())
  }

  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    load()
    setForm({ name: '', type: 'bank', institution: '', owner: 'husband', isShared: false, color: '#3b82f6' })
  }

  async function setHub(id: string) {
    await fetch(`/api/payment-methods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHub: true }),
    })
    load()
  }

  async function del(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/payment-methods/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {methods.map(m => (
          <div key={m.id} className="flex items-center justify-between border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.color ?? '#9ca3af' }} />
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-sm">{m.name}</span>
                  <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{TYPE_LABELS[m.type] ?? m.type}</span>
                  <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{OWNER_LABELS[m.owner] ?? m.owner}</span>
                  {m.isHub && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">허브</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {!m.isHub && (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setHub(m.id)}>
                  허브 지정
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500" onClick={() => del(m.id)}>
                삭제
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={add} className="grid grid-cols-2 gap-3">
            <div>
              <Label>이름</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <Label>기관</Label>
              <Input value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} required />
            </div>
            <div>
              <Label>종류</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">은행</SelectItem>
                  <SelectItem value="credit_card">신용카드</SelectItem>
                  <SelectItem value="debit_card">체크카드</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>소유</Label>
              <Select value={form.owner} onValueChange={v => setForm(p => ({ ...p, owner: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="husband">남편</SelectItem>
                  <SelectItem value="wife">아내</SelectItem>
                  <SelectItem value="joint">공동</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex gap-3 items-end">
              <div className="flex-1">
                <Label>색상</Label>
                <Input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
              </div>
              <Button type="submit">추가</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
