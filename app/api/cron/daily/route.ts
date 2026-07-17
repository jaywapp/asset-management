import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { runRiskAgent } from '@/lib/agents/risk'

export const dynamic = 'force-dynamic'

async function runDaily(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allUsers = await db.select({ id: users.id }).from(users)
  const representative = allUsers[0]
  if (!representative) return NextResponse.json({ success: true, familiesProcessed: 0 })

  await runRiskAgent(representative.id)
  return NextResponse.json({ success: true, familiesProcessed: 1 })
}

export const GET = runDaily
export const POST = runDaily
