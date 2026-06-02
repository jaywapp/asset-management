import { CACHE_SHORT, CACHE_LONG } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { income, expenses } from '@/lib/db/schema'
import { eq, and, lt } from 'drizzle-orm'

// 해당 월 이전까지의 누적 잔액 (이월금액)
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const monthStart = new Date(year, month - 1, 1)

  const [incRows, expRows] = await Promise.all([
    db.select({ amount: income.amount })
      .from(income)
      .where(and(eq(income.userId, session.user.id), lt(income.date, monthStart))),
    db.select({ amount: expenses.amount })
      .from(expenses)
      .where(and(eq(expenses.userId, session.user.id), lt(expenses.date, monthStart))),
  ])

  const totalIncome = incRows.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = expRows.reduce((s, r) => s + Number(r.amount), 0)
  const carryover = totalIncome - totalExpenses

  return NextResponse.json({ carryover }, {
    headers: CACHE_LONG,
  })
}
