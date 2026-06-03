'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, HelpCircle } from 'lucide-react'
import type { ParsedEntry } from '@/lib/csv-parsers/types'

const fmt = (n: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

type Step = 'idle' | 'analyzing' | 'resolving' | 'confirming' | 'done'

export function ConversationalImport({ paymentMethods }: { paymentMethods: any[] }) {
  const [pmId, setPmId] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [confirmed, setConfirmed] = useState<ParsedEntry[]>([])
  const [uncertain, setUncertain] = useState<ParsedEntry[]>([])
  const [answers, setAnswers] = useState<Record<string, Partial<ParsedEntry>>>({})
  const [savedCount, setSavedCount] = useState(0)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pmId) return
    setStep('analyzing')
    const csvText = await file.text()
    const res = await fetch('/api/import/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText, filename: file.name, paymentMethodId: pmId }),
    })
    const data = await res.json()
    if (data.needsManualSelect) { alert(data.error); setStep('idle'); return }
    setConfirmed(data.confirmed)
    setUncertain(data.uncertain)
    setStep(data.uncertain.length > 0 ? 'resolving' : 'confirming')
  }

  async function submitAnswers() {
    const answerList = Object.entries(answers).map(([tempId, ans]) => ({ tempId, ...ans }))
    const res = await fetch('/api/import/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uncertain, answers: answerList }),
    })
    const data = await res.json()
    setConfirmed(prev => [...prev, ...data.confirmed])
    setUncertain(data.uncertain)
    if (data.uncertain.length === 0) setStep('confirming')
  }

  async function save() {
    const res = await fetch('/api/import/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: confirmed, paymentMethodId: pmId }),
    })
    const data = await res.json()
    setSavedCount(data.saved)
    setStep('done')
  }

  if (step === 'done') return (
    <div className="text-center py-8">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <p className="font-medium">{savedCount}건 저장 완료</p>
      <Button className="mt-4" variant="outline" onClick={() => { setStep('idle'); setConfirmed([]); setUncertain([]); setSavedCount(0) }}>
        다시 가져오기
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">결제수단</label>
          <Select value={pmId} onValueChange={setPmId}>
            <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
            <SelectContent>
              {paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className={`cursor-pointer ${!pmId ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="border rounded-md px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100 transition-colors">
            CSV 파일 선택
          </div>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {step === 'analyzing' && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          AI가 거래내역을 분류하고 있습니다...
        </div>
      )}

      {step === 'resolving' && uncertain.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-500" />
              확인이 필요한 항목 {uncertain.length}건
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uncertain.map(entry => (
              <div key={entry.tempId} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{entry.description}</span>
                  <span className="text-gray-500">{fmt(entry.amount)} · {entry.date}</span>
                </div>
                {entry.question && (
                  <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded">{entry.question}</p>
                )}
                {entry.options && (
                  <div className="flex gap-2 flex-wrap">
                    {entry.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setAnswers(prev => ({ ...prev, [entry.tempId]: { ...prev[entry.tempId], category: opt as any } }))}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          answers[entry.tempId]?.category === opt
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button onClick={submitAnswers} className="w-full">답변 제출</Button>
          </CardContent>
        </Card>
      )}

      {step === 'confirming' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">저장할 항목 {confirmed.length}건</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
              {confirmed.map(e => (
                <div key={e.tempId} className="flex justify-between text-sm py-1 border-b last:border-0">
                  <span className="truncate mr-2">{e.description}</span>
                  <span className={`shrink-0 ${e.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {fmt(e.amount)}
                  </span>
                </div>
              ))}
            </div>
            <Button onClick={save} className="w-full">전체 저장</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
