'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-red-100">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-full bg-red-50 p-3 text-red-600">
            <AlertCircle size={24} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">데이터를 불러오지 못했습니다</h2>
            <p className="mt-1 text-sm text-gray-500">
              숫자를 0으로 대신 표시하지 않았습니다. 연결을 확인한 뒤 다시 시도해주세요.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={reset}>
            <RefreshCw size={15} className="mr-2" aria-hidden="true" />
            다시 시도
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
