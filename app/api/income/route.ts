import { CACHE_SHORT } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { income } from '@/lib/db/schema'
import { and, gte, inArray, lt } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const monthStart = new Date(year, month - 1, 1)
  const nextMonthStart = new Date(year, month, 1)
  const familyUserIds = await getFamilyUserIds(session.user.id)

  const rows = await db.select().from(income).where(and(
    inArray(income.userId, familyUserIds),
    gte(income.date, monthStart),
    lt(income.date, nextMonthStart),
  ))
  return NextResponse.json(rows, {
    headers: CACHE_SHORT,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(income).values({
    userId: session.user.id,
    category: body.category,
    amount: body.amount,
    description: body.description,
    date: new Date(body.date),
    isRecurring: body.isRecurring ?? false,
    paymentMethodId: body.paymentMethodId ?? null,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
