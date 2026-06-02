'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CashFlowChart } from '@/components/budget/CashFlowChart'
import { TrendingUp, TrendingDown, Trash2, Camera } from 'lucide-react'
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
}

export default function BudgetPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [entries, setEntries] = useState<Entry[]>([])

  // 빠른 입력 폼 상태
  const [type, setType] = useState<EntryType>('expense')
  const [category, setCategory] = useState('food')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(now.toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [showImageAnalyzer, setShowImageAnalyzer] = useState(false)
  const [pendingEntries, setPendingEntries] = useState<any[]>([])

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

  useEffect(() => { load() }, [year, month])

  // 타입 바뀔 때 카테고리 초기값 리셋
  useEffect(() => {
    setCategory(type === 'income' ? 'salary' : 'food')
  }, [type])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    const endpoint = type === 'income' ? '/api/income' : '/api/expenses'
    const body = type === 'income'
      ? { category, amount, description, date }
      : { category, amount, description, date, isFixed: false }
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setAmount('')
    setDescription('')
    setDate(now.toISOString().split('T')[0])
    await load()
    setSaving(false)
  }

  async function handleImageResult(entries: Record<string, unknown>[]) {
    setPendingEntries(entries)
    setShowImageAnalyzer(false)
  }

  async function savePendingEntries() {
    setSaving(true)
    for (const entry of pendingEntries) {
      const isIncome = entry.type === 'income'
      await fetch(isIncome ? '/api/income' : '/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: entry.category ?? 'other',
          amount: String(Math.abs(Number(entry.amount))),
          description: String(entry.description ?? ''),
          date: String(entry.date ?? new Date().toISOString().split('T')[0]),
          ...(isIncome ? {} : { isFixed: false }),
        }),
      })
    }
    setPendingEntries([])
    await load()
    setSaving(false)
  }

  async function handleDelete(entry: Entry) {
    const endpoint = entry.type === 'income' ? `/api/income/${entry.id}` : `/api/expenses/${entry.id}`
    await fetch(endpoint, { method: 'DELETE' })
    await load()
  }

  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const savings = totalIncome - totalExpenses
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS

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

      {/* 이미지 분석 영역 */}
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
          <CardContent className="space-y-2">
            {pendingEntries.map((e, i) => (
              <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${e.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-gray-500 text-xs">{CAT_LABELS[e.category as string] ?? e.category}</span>
                  <span className="text-gray-700">{String(e.description ?? '')}</span>
                  <span className="text-xs text-gray-400">{String(e.date ?? '')}</span>
                </div>
                <span className={`font-medium ${e.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {e.type === 'income' ? '+' : '-'}{fmt(Math.abs(Number(e.amount)))}
                </span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={savePendingEntries} disabled={saving}
                className="bg-green-600 hover:bg-green-700">
                {saving ? '저장 중...' : `${pendingEntries.length}건 저장`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingEntries([])}>취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
        <Card className="border-green-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <TrendingUp size={12} className="text-green-500" /> 수입
            </div>
            <p className="text-xl font-bold text-green-600">{fmt(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <TrendingDown size={12} className="text-red-500" /> 지출
            </div>
            <p className="text-xl font-bold text-red-500">{fmt(totalExpenses)}</p>
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
                저축률 {((savings / totalIncome) * 100).toFixed(1)}%
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
              <button type="button"
                onClick={() => setType('expense')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  type === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                지출
              </button>
              <button type="button"
                onClick={() => setType('income')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  type === 'income'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                수입
              </button>
            </div>

            {/* 카테고리 버튼 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {cats.map(c => (
                <button key={c} type="button"
                  onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    category === c
                      ? type === 'income' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {CAT_LABELS[c]}
                </button>
              ))}
            </div>

            {/* 금액 + 설명 + 날짜 */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="금액 (원)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 text-base"
                required
              />
              <Input
                placeholder="메모 (선택)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="flex-1"
              />
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-36"
                required
              />
              <Button type="submit" disabled={saving || !amount}
                className={type === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                {saving ? '...' : '추가'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 내역 목록 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {month}월 내역 ({entries.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">내역이 없습니다. 위에서 추가하세요.</p>
          ) : (
            <div className="space-y-0">
              {entries.map((entry, i) => {
                const isIncome = entry.type === 'income'
                const prevDate = i > 0 ? new Date(entries[i - 1].date).toLocaleDateString('ko-KR') : null
                const currDate = new Date(entry.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
                const showDateDivider = prevDate !== currDate

                return (
                  <div key={entry.id}>
                    {showDateDivider && (
                      <div className="text-xs text-gray-400 font-medium pt-3 pb-1 border-b">
                        {currDate}
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2.5 group">
                      <div className="flex items-center gap-3">
                        <span className={`w-1.5 h-1.5 rounded-full ${isIncome ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {CAT_LABELS[entry.category] ?? entry.category}
                            </Badge>
                            {entry.description && (
                              <span className="text-sm text-gray-600">{entry.description}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-500'}`}>
                          {isIncome ? '+' : '-'}{fmt(Number(entry.amount))}
                        </span>
                        <button
                          onClick={() => handleDelete(entry)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
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
