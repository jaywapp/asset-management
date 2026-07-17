import { auth } from '@/lib/auth'
import { NetWorthCard } from '@/components/dashboard/NetWorthCard'
import { MonthlyFlowCard } from '@/components/dashboard/MonthlyFlowCard'
import { AIBriefingCard } from '@/components/dashboard/AIBriefingCard'
import { getFamilyAssetSummary } from '@/lib/finance/summary'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const summary = await getFamilyAssetSummary(session.user.id)
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
          netWorth={summary.netWorth}
          portfolioValue={summary.portfolioValue}
          realEstateValue={summary.realEstateValue}
          cashBalance={summary.cashBalance}
          liabilities={summary.liabilities}
          gainLossPct={summary.portfolioGainLossPct}
        />
        <MonthlyFlowCard
          income={summary.monthlyIncome}
          expenses={summary.monthlyExpenses}
          savings={summary.monthlySavings}
        />
        <AIBriefingCard />
      </div>

      <div className="text-xs text-gray-400 bg-gray-100 rounded-md p-3">
        💡 <strong>시작하기:</strong> 계좌·카드 메뉴에서 자산 정보를 등록하면 가족 합산 현황을 확인할 수 있습니다.
      </div>
    </div>
  )
}
