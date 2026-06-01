import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runCFOAgent, saveCFOReport } from '@/lib/agents/cfo'
import { runInvestmentAgent } from '@/lib/agents/investment'
import { runRiskAgent } from '@/lib/agents/risk'
import { runRealEstateAgent } from '@/lib/agents/real-estate-agent'
import { runBudgetAgent } from '@/lib/agents/budget-agent'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentType, prompt, type = 'on_demand' } = await req.json()
  const userId = session.user.id
  let content = ''

  switch (agentType) {
    case 'cfo':
      content = await runCFOAgent(prompt ?? '전체 자산 현황을 간략히 브리핑해줘.', userId)
      await saveCFOReport(content, type)
      break
    case 'investment':
      content = await runInvestmentAgent(prompt ?? '포트폴리오 분석과 리밸런싱 제안을 해줘.', userId)
      await db.insert(aiReports).values({ type, agent: 'investment', content })
      break
    case 'risk':
      content = await runRiskAgent(userId)
      break
    case 'real-estate':
      content = await runRealEstateAgent(prompt ?? '부동산 자산 현황을 분석해줘.', userId)
      await db.insert(aiReports).values({ type, agent: 'real-estate', content })
      break
    case 'budget':
      content = await runBudgetAgent(userId)
      break
    default:
      return NextResponse.json({ error: 'Unknown agent type' }, { status: 400 })
  }

  return NextResponse.json({ content })
}
