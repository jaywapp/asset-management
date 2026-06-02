'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, Loader2 } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'

export function AIBriefingCard() {
  const [briefing, setBriefing] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agents/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentType: 'cfo',
        type: 'on_demand',
        prompt: '오늘의 자산 현황을 2-3문장으로 간결하게 브리핑해줘.',
      }),
    })
      .then(r => r.json())
      .then(d => setBriefing(d.content ?? '브리핑을 불러올 수 없습니다.'))
      .catch(() => setBriefing('CFO 연결 실패. API 키를 확인하세요.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="border-blue-100 bg-blue-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-blue-600 flex items-center gap-2">
          <Bot size={16} />
          CFO 브리핑
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-blue-400">
            <Loader2 size={14} className="animate-spin" />
            AI 분석 중...
          </div>
        ) : (
          <Markdown content={briefing} />
        )}
      </CardContent>
    </Card>
  )
}
