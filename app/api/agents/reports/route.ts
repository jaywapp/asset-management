import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select().from(aiReports).orderBy(desc(aiReports.createdAt)).limit(20)
  return NextResponse.json(rows)
}
