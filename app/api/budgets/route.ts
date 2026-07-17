import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const familyUserIds = await getFamilyUserIds(session.user.id)
  const rows = await db.select().from(budgets).where(and(
    inArray(budgets.userId, familyUserIds),
    eq(budgets.year, year),
    eq(budgets.month, month),
  ))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(budgets).values({
    userId: session.user.id,
    category: body.category,
    amount: body.amount,
    month: body.month,
    year: body.year,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
