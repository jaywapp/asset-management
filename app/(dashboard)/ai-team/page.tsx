'use client'
import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ChatInterface } from '@/components/ai-team/ChatInterface'
import { ReportCard } from '@/components/ai-team/ReportCard'
import { Loader2, RefreshCw } from 'lucide-react'

const AGENTS = [
  { key: 'risk', label: '리스크 체크' },
  { key: 'investment', label: '투자 분석' },
  { key: 'real-estate', label: '부동산 분석' },
  { key: 'budget', label: '가계부 결산' },
]

export default function AITeamPage() {
  const [reports, setReports] = useState<any[]>([])
  const [generating, setGenerating] = useState<string | null>(null)

  async function loadReports() {
    const res = await fetch('/api/agents/reports')
    if (res.ok) setReports(await res.json())
  }

  async function generateReport(agentType: string) {
    setGenerating(agentType)
    try {
      await fetch('/api/agents/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, type: 'on_demand' }),
      })
      await loadReports()
    } finally {
      setGenerating(null)
    }
  }

  useEffect(() => { loadReports() }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI 에이전트 팀</h1>

      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">CFO와 대화</TabsTrigger>
          <TabsTrigger value="reports">리포트 ({reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <ChatInterface />
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {AGENTS.map(({ key, label }) => (
              <Button key={key} variant="outline" size="sm"
                onClick={() => generateReport(key)}
                disabled={generating !== null}>
                {generating === key
                  ? <><Loader2 size={14} className="mr-1 animate-spin" />분석 중...</>
                  : <><RefreshCw size={14} className="mr-1" />{label}</>}
              </Button>
            ))}
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">리포트가 없습니다.</p>
              <p className="text-xs mt-1">위 버튼으로 AI 에이전트 분석을 시작하세요.</p>
            </div>
          ) : (
            reports.map((r: any) => <ReportCard key={r.id} {...r} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
