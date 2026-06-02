import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'

const AGENT_LABELS: Record<string, string> = {
  cfo: 'CFO', risk: '리스크 매니저', investment: '투자분석',
  'real-estate': '부동산', budget: '재무흐름',
}
const TYPE_LABELS: Record<string, string> = {
  daily: '일간', weekly: '주간', monthly: '월간', on_demand: '수시',
}
const AGENT_COLORS: Record<string, string> = {
  cfo: 'bg-blue-50 border-blue-100',
  risk: 'bg-orange-50 border-orange-100',
  investment: 'bg-green-50 border-green-100',
  'real-estate': 'bg-purple-50 border-purple-100',
  budget: 'bg-yellow-50 border-yellow-100',
}

interface Props {
  id: string
  agent: string
  type: string
  content: string
  createdAt: string
}

export function ReportCard({ agent, type, content, createdAt }: Props) {
  return (
    <Card className={AGENT_COLORS[agent] ?? ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot size={14} className="text-blue-500" />
            {AGENT_LABELS[agent] ?? agent}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{TYPE_LABELS[type] ?? type}</Badge>
            <span className="text-xs text-gray-400">
              {new Date(createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Markdown content={content} />
      </CardContent>
    </Card>
  )
}
