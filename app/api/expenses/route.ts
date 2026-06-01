import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const rows = await db.select().from(expenses).where(and(
    eq(expenses.userId, session.user.id),
    gte(expenses.date, monthStart),
    lte(expenses.date, monthEnd),
  ))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(expenses).values({
    userId: session.user.id,
    category: body.category,
    amount: body.amount,
    description: body.description,
    date: new Date(body.date),
    isFixed: body.isFixed ?? false,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
