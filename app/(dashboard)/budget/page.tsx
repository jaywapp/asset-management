'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CashFlowChart } from '@/components/budget/CashFlowChart'
import { Plus } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

const INCOME_CATS = ['salary', 'bonus', 'dividend', 'rental', 'freelance', 'other']
const EXPENSE_CATS = ['food', 'transport', 'housing', 'medical', 'education', 'leisure', 'subscription', 'other']
const CAT_LABELS: Record<string, string> = {
  salary: '급여', bonus: '상여', dividend: '배당', rental: '임대', freelance: '프리랜서', other: '기타',
  food: '식비', transport: '교통', housing: '주거', medical: '의료', education: '교육', leisure: '여가', subscription: '구독',
}

export default function BudgetPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [incomeItems, setIncomeItems] = useState<any[]>([])
  const [expenseItems, setExpenseItems] = useState<any[]>([])
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newIncome, setNewIncome] = useState({ category: 'salary', amount: '', description: '', date: new Date().toISOString().split('T')[0] })
  const [newExpense, setNewExpense] = useState({ category: 'food', amount: '', description: '', date: new Date().toISOString().split('T')[0], isFixed: false })

  async function load() {
    const [inc, exp] = await Promise.all([
      fetch(`/api/income?year=${year}&month=${month}`).then(r => r.json()),
      fetch(`/api/expenses?year=${year}&month=${month}`).then(r => r.json()),
    ])
    setIncomeItems(inc)
    setExpenseItems(exp)
  }

  useEffect(() => { load() }, [year, month])

  async function addIncome(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/income', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newIncome, amount: newIncome.amount }),
    })
    setShowAddIncome(false)
    setNewIncome({ category: 'salary', amount: '', description: '', date: new Date().toISOString().split('T')[0] })
    load()
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newExpense, amount: newExpense.amount }),
    })
    setShowAddExpense(false)
    setNewExpense({ category: 'food', amount: '', description: '', date: new Date().toISOString().split('T')[0], isFixed: false })
    load()
  }

  const totalIncome = incomeItems.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenseItems.reduce((s, e) => s + Number(e.amount), 0)
  const savings = totalIncome - totalExpenses

  const chartData = [{ month: `${month}월`, income: totalIncome, expenses: totalExpenses }]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">재무흐름</h1>
        <div className="flex gap-2 items-center">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="text-sm border rounded px-2 py-1">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="text-sm border rounded px-2 py-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">수입</p>
          <p className="text-xl font-bold text-green-600">{fmt(totalIncome)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">지출</p>
          <p className="text-xl font-bold text-red-500">{fmt(totalExpenses)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">순저축</p>
          <p className={`text-xl font-bold ${savings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(savings)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>현금흐름 차트</CardTitle></CardHeader>
        <CardContent><CashFlowChart data={chartData} /></CardContent>
      </Card>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">수입 내역</TabsTrigger>
          <TabsTrigger value="expenses">지출 내역</TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-4 space-y-3">
          <Button variant="outline" size="sm" onClick={() => setShowAddIncome(!showAddIncome)}>
            <Plus size={14} className="mr-1" /> 수입 추가
          </Button>
          {showAddIncome && (
            <Card><CardContent className="pt-4">
              <form onSubmit={addIncome} className="grid grid-cols-2 gap-3">
                <div><Label>카테고리</Label>
                  <Select value={newIncome.category} onValueChange={v => setNewIncome(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INCOME_CATS.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>금액 (원)</Label>
                  <Input type="number" value={newIncome.amount} onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div><Label>설명</Label>
                  <Input value={newIncome.description} onChange={e => setNewIncome(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div><Label>날짜</Label>
                  <Input type="date" value={newIncome.date} onChange={e => setNewIncome(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div className="col-span-2"><Button type="submit" size="sm">저장</Button></div>
              </form>
            </CardContent></Card>
          )}
          {incomeItems.length === 0
            ? <p className="text-sm text-gray-400">이번달 수입 내역이 없습니다.</p>
            : incomeItems.map(i => (
              <div key={i.id} className="flex justify-between items-center py-2 border-b text-sm last:border-0">
                <div>
                  <span className="font-medium">{CAT_LABELS[i.category] ?? i.category}</span>
                  {i.description && <span className="text-gray-400 ml-2">{i.description}</span>}
                  <span className="text-xs text-gray-400 ml-2">{new Date(i.date).toLocaleDateString('ko-KR')}</span>
                </div>
                <span className="text-green-600 font-medium">{fmt(Number(i.amount))}</span>
              </div>
            ))}
        </TabsContent>

        <TabsContent value="expenses" className="mt-4 space-y-3">
          <Button variant="outline" size="sm" onClick={() => setShowAddExpense(!showAddExpense)}>
            <Plus size={14} className="mr-1" /> 지출 추가
          </Button>
          {showAddExpense && (
            <Card><CardContent className="pt-4">
              <form onSubmit={addExpense} className="grid grid-cols-2 gap-3">
                <div><Label>카테고리</Label>
                  <Select value={newExpense.category} onValueChange={v => setNewExpense(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATS.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>금액 (원)</Label>
                  <Input type="number" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div><Label>설명</Label>
                  <Input value={newExpense.description} onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div><Label>날짜</Label>
                  <Input type="date" value={newExpense.date} onChange={e => setNewExpense(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div className="col-span-2"><Button type="submit" size="sm">저장</Button></div>
              </form>
            </CardContent></Card>
          )}
          {expenseItems.length === 0
            ? <p className="text-sm text-gray-400">이번달 지출 내역이 없습니다.</p>
            : expenseItems.map(e => (
              <div key={e.id} className="flex justify-between items-center py-2 border-b text-sm last:border-0">
                <div>
                  <span className="font-medium">{CAT_LABELS[e.category] ?? e.category}</span>
                  {e.description && <span className="text-gray-400 ml-2">{e.description}</span>}
                  <span className="text-xs text-gray-400 ml-2">{new Date(e.date).toLocaleDateString('ko-KR')}</span>
                </div>
                <span className="text-red-500 font-medium">{fmt(Number(e.amount))}</span>
              </div>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
