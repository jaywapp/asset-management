import { auth } from '@/lib/auth'
import { NetWorthCard } from '@/components/dashboard/NetWorthCard'
import { MonthlyFlowCard } from '@/components/dashboard/MonthlyFlowCard'
import { AIBriefingCard } from '@/components/dashboard/AIBriefingCard'

async function getSummary() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/assets/summary`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const session = await auth()
  const summary = await getSummary()
  const now = new Date()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {session?.user?.name}님 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NetWorthCard
          netWorth={summary?.netWorth ?? 0}
          portfolioValue={summary?.portfolioValue ?? 0}
          realEstateValue={summary?.realEstateValue ?? 0}
          gainLossPct={summary?.portfolioGainLossPct ?? 0}
        />
        <MonthlyFlowCard
          income={summary?.monthlyIncome ?? 0}
          expenses={summary?.monthlyExpenses ?? 0}
          savings={summary?.monthlySavings ?? 0}
        />
        <AIBriefingCard />
      </div>

      <div className="text-xs text-gray-400 bg-gray-100 rounded-md p-3">
        💡 <strong>시작하기:</strong> 설정 메뉴에서 계좌와 종목을 등록하면 AI 팀이 자산을 분석합니다.
      </div>
    </div>
  )
}
