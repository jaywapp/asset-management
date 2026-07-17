'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bot, RotateCcw, User } from 'lucide-react'
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
interface PaymentMethodOption { id: string; name: string }

export default function SettingsPage() {
  const [paymentMethodsList, setPaymentMethodsList] = useState<PaymentMethodOption[]>([])
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
    const timer = window.setTimeout(() => {
      void Promise.all([loadPrompts(), loadAccountInfo()])
      void fetch('/api/payment-methods').then(r => r.json()).then(setPaymentMethodsList)
    }, 0)
    return () => window.clearTimeout(timer)
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

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">설정</h1>

      <Tabs defaultValue="account">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="account">내 계정</TabsTrigger>
          <TabsTrigger value="prompts">AI 지침</TabsTrigger>
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
