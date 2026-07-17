import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { runCFOAgent, saveCFOReport } from '@/lib/agents/cfo'

export const dynamic = 'force-dynamic'

async function runWeekly(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allUsers = await db.select({ id: users.id }).from(users)
  const representative = allUsers[0]
  if (!representative) return NextResponse.json({ success: true, familiesProcessed: 0 })

  const content = await runCFOAgent(
    '이번 주 포트폴리오 성과를 분석하고 다음 주 주목할 사항을 정리해줘.',
    representative.id,
  )
  await saveCFOReport(content, 'weekly')
  return NextResponse.json({ success: true, familiesProcessed: 1 })
}

export const GET = runWeekly
export const POST = runWeekly
