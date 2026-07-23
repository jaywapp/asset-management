import packageJson from '@/package.json'
import { MessageSquareWarning } from 'lucide-react'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function FeedbackPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">제보</h1>
        <p className="mt-1 text-sm text-gray-500">
          문제를 알려 주거나 개선 의견을 보내 주세요. 제보는 이 프로젝트의
          GitHub Issue로 등록됩니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareWarning size={18} aria-hidden="true" />
            제보 내용
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FeedbackForm appVersion={packageJson.version} />
        </CardContent>
      </Card>
    </div>
  )
}
