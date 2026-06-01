import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { runCFOAgent, saveCFOReport } from '@/lib/agents/cfo'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allUsers = await db.select({ id: users.id }).from(users)
  const processed = new Set<string>()
  for (const user of allUsers) {
    if (!processed.has(user.id)) {
      const content = await runCFOAgent(
        '이번 주 포트폴리오 성과를 분석하고 다음 주 주목할 사항을 정리해줘.',
        user.id
      )
      await saveCFOReport(content, 'weekly')
      processed.add(user.id)
    }
  }
  return NextResponse.json({ success: true })
}
