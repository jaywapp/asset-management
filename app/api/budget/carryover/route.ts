import { CACHE_LONG } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { income, expenses } from '@/lib/db/schema'
import { and, inArray, lt } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'
import { sumAmounts, sumRealExpenses } from '@/lib/finance/calculations'

// 해당 월 이전까지의 누적 잔액 (이월금액)
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const monthStart = new Date(year, month - 1, 1)
  const familyUserIds = await getFamilyUserIds(session.user.id)

  const [incRows, expRows] = await Promise.all([
    db.select({ amount: income.amount })
      .from(income)
      .where(and(inArray(income.userId, familyUserIds), lt(income.date, monthStart))),
    db.select({ amount: expenses.amount, transferType: expenses.transferType })
      .from(expenses)
      .where(and(inArray(expenses.userId, familyUserIds), lt(expenses.date, monthStart))),
  ])

  const totalIncome = sumAmounts(incRows)
  const totalExpenses = sumRealExpenses(expRows)
  const carryover = totalIncome - totalExpenses

  return NextResponse.json({ carryover }, {
    headers: CACHE_LONG,
  })
}
