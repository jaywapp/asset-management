import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { runBudgetAgent } from '@/lib/agents/budget-agent'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allUsers = await db.select({ id: users.id }).from(users)
  const processed = new Set<string>()
  for (const user of allUsers) {
    if (!processed.has(user.id)) {
      await runBudgetAgent(user.id)
      processed.add(user.id)
    }
  }
  return NextResponse.json({ success: true })
}
