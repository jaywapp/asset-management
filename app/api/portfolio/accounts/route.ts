import { CACHE_SHORT, CACHE_LONG } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select().from(accounts).where(eq(accounts.userId, session.user.id))
  return NextResponse.json(rows, {
    headers: CACHE_LONG,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(accounts).values({
    userId: session.user.id,
    name: body.name,
    type: body.type,
    institution: body.institution,
    currency: body.currency ?? 'KRW',
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
