import { CACHE_LONG } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const rows = await db.select().from(accounts).where(inArray(accounts.userId, familyUserIds))
  return NextResponse.json(rows, {
    headers: CACHE_LONG,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const exchangeRateToKrw = Number(body.exchangeRateToKrw ?? 1)
  if (!name || !['stock', 'fund', 'deposit', 'crypto', 'saving'].includes(body.type)) {
    return NextResponse.json({ error: 'Invalid account' }, { status: 400 })
  }
  if (!Number.isFinite(exchangeRateToKrw) || exchangeRateToKrw <= 0) {
    return NextResponse.json({ error: 'Exchange rate must be greater than zero' }, { status: 400 })
  }
  const [row] = await db.insert(accounts).values({
    userId: session.user.id,
    name,
    type: body.type,
    institution: body.institution,
    currency: body.currency ?? 'KRW',
    exchangeRateToKrw: String(exchangeRateToKrw),
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
