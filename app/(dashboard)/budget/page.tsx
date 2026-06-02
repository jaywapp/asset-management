'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CashFlowChart } from '@/components/budget/CashFlowChart'
import { TrendingUp, TrendingDown, Trash2, Camera, Pin, Pencil, X, Check, CheckSquare, RefreshCw } from 'lucide-react'
import { ImageAnalyzer } from '@/components/ui/image-analyzer'

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

const INCOME_CATS = ['salary', 'bonus', 'dividend', 'rental', 'freelance', 'other']
const EXPENSE_CATS = ['food', 'transport', 'housing', 'medical', 'education', 'leisure', 'subscription', 'other']
const CAT_LABELS: Record<string, string> = {
  salary: '급여', bonus: '상여', dividend: '배당', rental: '임대', freelance: '프리랜서', other: '기타',
  food: '식비', transport: '교통', housing: '주거', medical: '의료',
  education: '교육', leisure: '여가', subscription: '구독',
}

type EntryType = 'income' | 'expense'

interface Entry {
  id: string
  type: EntryType
  category: string
  amount: string
  description: string | null
  date: string
  isFixed?: boolean
  isRecurring?: boolean
}

interface RecurringTemplate {
  id: string
  category: string
  amount: string
  description: string | null
}

interface EditForm {
  category: string
  amount: string
  description: string
  date: string
  isFixed: boolean
}

export default function BudgetPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [entries, setEntries] = useState<Entry[]>([])

  // 새 항목 입력
  const [type, setType] = useState<EntryType>('expense')
  const [isFixed, setIsFixed] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [category, setCategory] = useState('food')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(now.toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [showImageAnalyzer, setShowImageAnalyzer] = useState(false)
  const [pendingEntries, setPendingEntries] = useState<any[]>([])

  // 반복 고정지출
  const [pendingRecurring, setPendingRecurring] = useState<RecurringTemplate[]>([])
  const [recurringApplying, setRecurringApplying] = useState(false)

  // 이미지 분석 결과 고정/반복 메타 (index → {isFixed, isRecurring})
  const [pendingMeta, setPendingMeta] = useState<{ isFixed: boolean; isRecurring: boolean }[]>([])

  // 필터
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'fixed' | 'variable'>('all')

  // 개별 편집
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ category: '', amount: '', description: '', date: '', isFixed: false })

  // 일괄 편집
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  async function load() {
    const [inc, exp] = await Promise.all([
      fetch(`/api/income?year=${year}&month=${month}`).then(r => r.json()),
      fetch(`/api/expenses?year=${year}&month=${month}`).then(r => r.json()),
    ])
    const combined: Entry[] = [
      ...inc.map((i: any) => ({ ...i, type: 'income' as EntryType })),
      ...exp.map((e: any) => ({ ...e, type: 'expense' as EntryType })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setEntries(combined)
  }

  async function checkRecurring() {
    // 현재 달 이전이면 반복 배너 안 보여줌
    const currentMonth = new Date()
    if (year < currentMonth.getFullYear() ||
      (year === currentMonth.getFullYear() && month < currentMonth.getMonth() + 1)) {
      setPendingRecurring([])
      return
    }
    const res = await fetch(`/api/expenses/recurring?year=${year}&month=${month}`)
    if (res.ok) {
      const data = await res.json()
      setPendingRecurring(data)
    }
  }

  useEffect(() => {
    load()
    checkRecurring()
  }, [year, month])

  useEffect(() => {
    setCategory(type === 'income' ? 'salary' : 'food')
    if (type === 'income') { setIsFixed(false); setIsRecurring(false) }
  }, [type])

  useEffect(() => {
    if (!isFixed) setIsRecurring(false)
  }, [isFixed])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    const endpoint = type === 'income' ? '/api/income' : '/api/expenses'
    const body = type === 'income'
      ? { category, amount, description, date }
      : { category, amount, description, date, isFixed, isRecurring: isFixed && isRecurring }
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setAmount('')
    setDescription('')
    setDate(now.toISOString().split('T')[0])
    await load()
    await checkRecurring()
    setSaving(false)
  }

  async function applyRecurring() {
    setRecurringApplying(true)
    await fetch('/api/expenses/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year, month,
        items: pendingRecurring.map(r => ({
          category: r.category,
          amount: r.amount,
          description: r.description,
        })),
      }),
    })
    setPendingRecurring([])
    await load()
    setRecurringApplying(false)
  }

  async function handleImageResult(entries: Record<string, unknown>[]) {
    setPendingEntries(entries)
    setPendingMeta(entries.map(() => ({ isFixed: false, isRecurring: false })))
    setShowImageAnalyzer(false)
  }

  async function savePendingEntries() {
    setSaving(true)
    for (let i = 0; i < pendingEntries.length; i++) {
      const entry = pendingEntries[i]
      const meta = pendingMeta[i] ?? { isFixed: false, isRecurring: false }
      const isIncome = entry.type === 'income'
      await fetch(isIncome ? '/api/income' : '/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: entry.category ?? 'other',
          amount: String(Math.abs(Number(entry.amount))),
          description: String(entry.description ?? ''),
          date: String(entry.date ?? new Date().toISOString().split('T')[0]),
          ...(isIncome ? {} : { isFixed: meta.isFixed, isRecurring: meta.isFixed && meta.isRecurring }),
        }),
      })
    }
    setPendingEntries([])
    setPendingMeta([])
    await load()
    await checkRecurring()
    setSaving(false)
  }

  async function handleDelete(entry: Entry) {
    const endpoint = entry.type === 'income' ? `/api/income/${entry.id}` : `/api/expenses/${entry.id}`
    await fetch(endpoint, { method: 'DELETE' })
    await load()
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id)
    setEditForm({
      category: entry.category,
      amount: String(entry.amount),
      description: entry.description ?? '',
      date: entry.date.split('T')[0],
      isFixed: entry.isFixed ?? false,
    })
  }

  async function saveEdit(entry: Entry) {
    if (!editForm.amount || Number(editForm.amount) <= 0) return
    const endpoint = entry.type === 'income' ? `/api/income/${entry.id}` : `/api/expenses/${entry.id}`
    const body = entry.type === 'income'
      ? { category: editForm.category, amount: editForm.amount, description: editForm.description, date: editForm.date }
      : { category: editForm.category, amount: editForm.amount, description: editForm.description, date: editForm.date, isFixed: editForm.isFixed }
    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditingId(null)
    await load()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)))
    }
  }

  async function bulkChangeCategory() {
    if (!bulkCategory || selectedIds.size === 0) return
    setBulkSaving(true)
    const selected = entries.filter(e => selectedIds.has(e.id))
    await Promise.all(selected.map(entry => {
      const endpoint = entry.type === 'income' ? `/api/income/${entry.id}` : `/api/expenses/${entry.id}`
      return fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: bulkCategory }),
      })
    }))
    setBulkCategory('')
    setSelectedIds(new Set())
    setBulkMode(false)
    await load()
    setBulkSaving(false)
  }

  async function bulkToggleFixed(toFixed: boolean) {
    if (selectedIds.size === 0) return
    setBulkSaving(true)
    const selected = entries.filter(e => selectedIds.has(e.id) && e.type === 'expense')
    await Promise.all(selected.map(entry =>
      fetch(`/api/expenses/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFixed: toFixed }),
      })
    ))
    setSelectedIds(new Set())
    setBulkMode(false)
    await load()
    setBulkSaving(false)
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제할까요?`)) return
    setBulkSaving(true)
    const selected = entries.filter(e => selectedIds.has(e.id))
    await Promise.all(selected.map(entry => {
      const endpoint = entry.type === 'income' ? `/api/income/${entry.id}` : `/api/expenses/${entry.id}`
      return fetch(endpoint, { method: 'DELETE' })
    }))
    setSelectedIds(new Set())
    setBulkMode(false)
    await load()
    setBulkSaving(false)
  }

  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0)
  const allExpenses = entries.filter(e => e.type === 'expense')
  const fixedExpenses = allExpenses.filter(e => e.isFixed)
  const variableExpenses = allExpenses.filter(e => !e.isFixed)
  const totalExpenses = allExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalFixed = fixedExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalVariable = variableExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const savings = totalIncome - totalExpenses
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS

  const filteredEntries = entries.filter(e => {
    if (expenseFilter === 'fixed') return e.type === 'expense' && e.isFixed
    if (expenseFilter === 'variable') return e.type === 'expense' && !e.isFixed
    return true
  })

  const selectedEntries = entries.filter(e => selectedIds.has(e.id))
  const hasOnlyExpenses = selectedEntries.every(e => e.type === 'expense')
  const hasOnlyIncome = selectedEntries.every(e => e.type === 'income')
  const bulkCats = hasOnlyIncome ? INCOME_CATS : hasOnlyExpenses ? EXPENSE_CATS : []

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">가계부</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImageAnalyzer(!showImageAnalyzer)}>
            <Camera size={14} className="mr-1" />이미지 입력
          </Button>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="text-sm border rounded px-2 py-1 bg-white">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="text-sm border rounded px-2 py-1 bg-white">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>
      </div>

      {/* 반복 고정지출 배너 */}
      {pendingRecurring.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <RefreshCw size={14} className="text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-700">
                    이번 달 고정지출 {pendingRecurring.length}건이 아직 적용되지 않았습니다
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {pendingRecurring.map((r, i) => (
                      <span key={i} className="text-xs bg-white border border-orange-200 text-orange-600 px-2 py-0.5 rounded-full">
                        {CAT_LABELS[r.category] ?? r.category}
                        {r.description ? ` · ${r.description}` : ''}
                        {' '}
                        <span className="font-medium">{fmt(Number(r.amount))}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={applyRecurring} disabled={recurringApplying}
                  className="bg-orange-500 hover:bg-orange-600 text-xs h-7 px-3">
                  {recurringApplying ? '적용 중...' : '이번 달 적용'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingRecurring([])}
                  className="text-xs h-7 px-2 text-gray-400">
                  닫기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 이미지 분석 */}
      {showImageAnalyzer && (
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Camera size={14} className="text-purple-500" />AI 이미지 분석
            </CardTitle>
            <p className="text-xs text-gray-400">영수증, 카드 사용내역, 은행 출금내역을 업로드하세요.</p>
          </CardHeader>
          <CardContent>
            <ImageAnalyzer context="budget" onResult={handleImageResult} label="거래내역 이미지 업로드" />
          </CardContent>
        </Card>
      )}

      {/* AI 분석 결과 확인 */}
      {pendingEntries.length > 0 && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700">
              AI 분석 결과 ({pendingEntries.length}건) — 확인 후 저장하세요
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {pendingEntries.map((e, i) => {
              const meta = pendingMeta[i] ?? { isFixed: false, isRecurring: false }
              const isExpense = e.type !== 'income'
              return (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${!isExpense ? 'bg-green-500' : meta.isFixed ? 'bg-orange-400' : 'bg-red-500'}`} />
                    <span className="text-gray-500 text-xs shrink-0">{CAT_LABELS[e.category as string] ?? e.category}</span>
                    <span className="text-sm text-gray-700 truncate">{String(e.description ?? '')}</span>
                    <span className="text-xs text-gray-400 shrink-0">{String(e.date ?? '')}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isExpense && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPendingMeta(prev => prev.map((m, idx) =>
                            idx === i ? { ...m, isFixed: !m.isFixed, isRecurring: !m.isFixed ? m.isRecurring : false } : m
                          ))}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors flex items-center gap-0.5 ${
                            meta.isFixed ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-gray-50 text-gray-400 border-gray-200'
                          }`}>
                          <Pin size={9} />고정
                        </button>
                        {meta.isFixed && (
                          <button
                            onClick={() => setPendingMeta(prev => prev.map((m, idx) =>
                              idx === i ? { ...m, isRecurring: !m.isRecurring } : m
                            ))}
                            className={`text-xs px-1.5 py-0.5 rounded border transition-colors flex items-center gap-0.5 ${
                              meta.isRecurring ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-gray-50 text-gray-400 border-gray-200'
                            }`}>
                            <RefreshCw size={9} />반복
                          </button>
                        )}
                      </div>
                    )}
                    <span className={`font-medium text-sm ${!isExpense ? 'text-green-600' : meta.isFixed ? 'text-orange-500' : 'text-red-500'}`}>
                      {!isExpense ? '+' : '-'}{fmt(Math.abs(Number(e.amount)))}
                    </span>
                  </div>
                </div>
              )
            })}
            <div className="flex gap-2 pt-3">
              <Button size="sm" onClick={savePendingEntries} disabled={saving}
                className="bg-green-600 hover:bg-green-700">
                {saving ? '저장 중...' : `${pendingEntries.length}건 저장`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setPendingEntries([]); setPendingMeta([]) }}>취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-green-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <TrendingUp size={12} className="text-green-500" /> 수입
            </div>
            <p className="text-xl font-bold text-green-600">{fmt(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <Pin size={12} className="text-orange-500" /> 고정지출
            </div>
            <p className="text-xl font-bold text-orange-500">{fmt(totalFixed)}</p>
            {totalExpenses > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{((totalFixed / totalExpenses) * 100).toFixed(0)}%</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-red-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <TrendingDown size={12} className="text-red-500" /> 변동지출
            </div>
            <p className="text-xl font-bold text-red-500">{fmt(totalVariable)}</p>
            {totalExpenses > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{((totalVariable / totalExpenses) * 100).toFixed(0)}%</p>
            )}
          </CardContent>
        </Card>
        <Card className={savings >= 0 ? 'border-blue-100' : 'border-red-100'}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 mb-1">순저축</p>
            <p className={`text-xl font-bold ${savings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {fmt(savings)}
            </p>
            {totalIncome > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                {((savings / totalIncome) * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 빠른 입력 폼 */}
      <Card className="border-2 border-dashed border-gray-200">
        <CardContent className="pt-4 pb-4">
          <form onSubmit={handleSubmit}>
            {/* 수입/지출 토글 */}
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setType('expense')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                지출
              </button>
              <button type="button" onClick={() => setType('income')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  type === 'income' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                수입
              </button>
            </div>

            {/* 고정/변동 토글 + 반복 체크박스 (지출일 때만) */}
            {type === 'expense' && (
              <div className="flex gap-2 mb-3 items-center">
                <button type="button" onClick={() => setIsFixed(false)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    !isFixed ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-gray-50 text-gray-400 border border-gray-200'
                  }`}>
                  변동지출
                </button>
                <button type="button" onClick={() => setIsFixed(true)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    isFixed ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-gray-50 text-gray-400 border border-gray-200'
                  }`}>
                  <Pin size={11} />고정지출
                </button>
                {isFixed && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap pl-1">
                    <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                      className="accent-orange-500 w-3.5 h-3.5" />
                    <RefreshCw size={11} className="text-orange-400" />매월 반복
                  </label>
                )}
              </div>
            )}

            {/* 카테고리 버튼 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {cats.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    category === c
                      ? type === 'income' ? 'bg-green-500 text-white'
                        : isFixed ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {CAT_LABELS[c]}
                </button>
              ))}
            </div>

            {/* 1행: 금액 + 메모 */}
            <div className="flex gap-2 mb-2">
              <Input type="number" placeholder="금액 (원)" value={amount}
                onChange={e => setAmount(e.target.value)} className="w-36 text-base" required />
              <Input placeholder="메모 (선택)" value={description}
                onChange={e => setDescription(e.target.value)} className="flex-1" />
            </div>
            {/* 2행: 날짜 + 추가 버튼 */}
            <div className="flex gap-2">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="flex-1" required />
              <Button type="submit" disabled={saving || !amount}
                className={`px-6 ${type === 'income' ? 'bg-green-500 hover:bg-green-600'
                  : isFixed ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-500 hover:bg-red-600'}`}>
                {saving ? '...' : '추가'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 내역 목록 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{month}월 내역 ({filteredEntries.length}건)</CardTitle>
            <div className="flex gap-2 items-center">
              {(['all', 'fixed', 'variable'] as const).map(f => (
                <button key={f} onClick={() => setExpenseFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    expenseFilter === f
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {f === 'all' ? '전체' : f === 'fixed' ? '고정' : '변동'}
                </button>
              ))}
              <button
                onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); setEditingId(null) }}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 ${
                  bulkMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                <CheckSquare size={11} />선택
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* 일괄 선택 액션바 */}
          {bulkMode && selectedIds.size > 0 && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-700">{selectedIds.size}건 선택됨</span>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600">
                  선택 해제
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {bulkCats.length > 0 && (
                  <div className="flex gap-1 items-center">
                    <select
                      value={bulkCategory}
                      onChange={e => setBulkCategory(e.target.value)}
                      className="text-xs border rounded px-2 py-1 bg-white">
                      <option value="">카테고리 선택</option>
                      {bulkCats.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                    </select>
                    <Button size="sm" onClick={bulkChangeCategory} disabled={!bulkCategory || bulkSaving}
                      className="text-xs h-7 px-2 bg-blue-600 hover:bg-blue-700">
                      변경
                    </Button>
                  </div>
                )}
                {hasOnlyExpenses && (
                  <>
                    <Button size="sm" onClick={() => bulkToggleFixed(true)} disabled={bulkSaving}
                      className="text-xs h-7 px-2 bg-orange-500 hover:bg-orange-600">
                      <Pin size={10} className="mr-1" />고정으로
                    </Button>
                    <Button size="sm" onClick={() => bulkToggleFixed(false)} disabled={bulkSaving}
                      className="text-xs h-7 px-2 bg-red-500 hover:bg-red-600">
                      변동으로
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={bulkDelete} disabled={bulkSaving}
                  className="text-xs h-7 px-2 border-red-300 text-red-500 hover:bg-red-50">
                  <Trash2 size={10} className="mr-1" />삭제
                </Button>
              </div>
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">내역이 없습니다.</p>
          ) : (
            <div className="space-y-0">
              {bulkMode && (
                <div className="flex items-center gap-2 py-1.5 border-b mb-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredEntries.length && filteredEntries.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs text-gray-400">전체 선택</span>
                </div>
              )}

              {filteredEntries.map((entry, i) => {
                const isIncome = entry.type === 'income'
                const prevDate = i > 0 ? new Date(filteredEntries[i - 1].date).toLocaleDateString('ko-KR') : null
                const currDate = new Date(entry.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
                const showDateDivider = prevDate !== currDate
                const isEditing = editingId === entry.id
                const isSelected = selectedIds.has(entry.id)
                const editCats = isIncome ? INCOME_CATS : EXPENSE_CATS

                return (
                  <div key={entry.id}>
                    {showDateDivider && (
                      <div className="text-xs text-gray-400 font-medium pt-3 pb-1 border-b">{currDate}</div>
                    )}

                    {isEditing ? (
                      <div className="py-2 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {editCats.map(c => (
                            <button key={c} type="button"
                              onClick={() => setEditForm(f => ({ ...f, category: c }))}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                editForm.category === c
                                  ? isIncome ? 'bg-green-500 text-white' : editForm.isFixed ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                              {CAT_LABELS[c]}
                            </button>
                          ))}
                        </div>
                        {!isIncome && (
                          <div className="flex gap-1">
                            <button type="button"
                              onClick={() => setEditForm(f => ({ ...f, isFixed: false }))}
                              className={`px-2 py-0.5 rounded text-xs ${!editForm.isFixed ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                              변동
                            </button>
                            <button type="button"
                              onClick={() => setEditForm(f => ({ ...f, isFixed: true }))}
                              className={`px-2 py-0.5 rounded text-xs flex items-center gap-0.5 ${editForm.isFixed ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                              <Pin size={9} />고정
                            </button>
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <Input type="number" value={editForm.amount}
                            onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                            className="w-28 h-8 text-sm" placeholder="금액" />
                          <Input value={editForm.description}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            className="flex-1 h-8 text-sm" placeholder="메모" />
                          <Input type="date" value={editForm.date}
                            onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                            className="w-32 h-8 text-sm" />
                          <button onClick={() => saveEdit(entry)}
                            className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex items-center justify-between py-2.5 group ${isSelected ? 'bg-blue-50 -mx-4 px-4 rounded' : ''}`}>
                        <div className="flex items-center gap-3">
                          {bulkMode && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(entry.id)}
                              className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                            />
                          )}
                          <span className={`w-1.5 h-1.5 rounded-full ${isIncome ? 'bg-green-500' : entry.isFixed ? 'bg-orange-400' : 'bg-red-500'}`} />
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {CAT_LABELS[entry.category] ?? entry.category}
                            </Badge>
                            {entry.isFixed && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">
                                <Pin size={10} />고정
                              </span>
                            )}
                            {entry.isRecurring && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-orange-400 opacity-70">
                                <RefreshCw size={9} />
                              </span>
                            )}
                            {entry.description && (
                              <span className="text-sm text-gray-600">{entry.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isIncome ? 'text-green-600' : entry.isFixed ? 'text-orange-500' : 'text-red-500'}`}>
                            {isIncome ? '+' : '-'}{fmt(Number(entry.amount))}
                          </span>
                          {!bulkMode && (
                            <>
                              <button onClick={() => startEdit(entry)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 transition-opacity">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleDelete(entry)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 현금흐름 차트 */}
      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">현금흐름</CardTitle></CardHeader>
          <CardContent>
            <CashFlowChart data={[{ month: `${month}월`, income: totalIncome, expenses: totalExpenses }]} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
