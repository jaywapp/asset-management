'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, Loader2, RefreshCw } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'

const BRIEFING_PROMPT = `오늘 날짜 기준으로 자산 현황을 아래 형식으로 브리핑해줘.
데이터가 없는 항목은 "데이터 없음"으로 표시해.

## 📊 순자산
- 총 순자산: (금액)
- 금융자산: (금액) / 부동산: (금액)

## 📈 포트폴리오
- 총 평가금액: (금액)
- 전체 수익률: (%) — 수익 빨간색/손실 파란색 기준

## 💰 이번 달 가계부
- 수입: (금액) / 지출: (금액)
- 고정지출: (금액) / 변동지출: (금액)
- 저축률: (%)

## 💬 한마디
(1문장 코멘트)
`

export function AIBriefingCard() {
  const [briefing, setBriefing] = useState('')
  const [loading, setLoading] = useState(false)
  const [requested, setRequested] = useState(false)

  async function fetchBriefing() {
    setLoading(true)
    setRequested(true)
    try {
      const res = await fetch('/api/agents/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType: 'cfo', type: 'on_demand', prompt: BRIEFING_PROMPT }),
      })
      const d = await res.json()
      setBriefing(d.content ?? '브리핑을 불러올 수 없습니다.')
    } catch {
      setBriefing('CFO 연결 실패. API 키를 확인하세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-blue-100 bg-blue-50/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-blue-600 flex items-center gap-2">
            <Bot size={16} />
            CFO 브리핑
          </CardTitle>
          {requested && !loading && (
            <button onClick={fetchBriefing}
              className="text-blue-400 hover:text-blue-600 transition-colors">
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!requested ? (
          <div className="flex flex-col items-center justify-center py-4 gap-3">
            <p className="text-xs text-gray-400 text-center">AI CFO에게 오늘의 자산 현황을 물어보세요</p>
            <Button size="sm" onClick={fetchBriefing}
              className="bg-blue-500 hover:bg-blue-600 text-xs h-7 px-3">
              <Bot size={12} className="mr-1" />브리핑 요청
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-blue-400 py-4 justify-center">
            <Loader2 size={14} className="animate-spin" />
            분석 중...
          </div>
        ) : (
          <Markdown content={briefing} />
        )}
      </CardContent>
    </Card>
  )
}
