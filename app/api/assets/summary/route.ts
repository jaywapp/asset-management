import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts, holdings, realEstate, income, expenses } from '@/lib/db/schema'
import { eq, inArray, gte, lte, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [userAccounts, userRealEstate, monthIncome, monthExpenses] = await Promise.all([
    db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(realEstate).where(eq(realEstate.userId, userId)),
    db.select().from(income).where(and(
      eq(income.userId, userId),
      gte(income.date, monthStart),
      lte(income.date, monthEnd),
    )),
    db.select().from(expenses).where(and(
      eq(expenses.userId, userId),
      gte(expenses.date, monthStart),
      lte(expenses.date, monthEnd),
    )),
  ])

  const accountIds = userAccounts.map(a => a.id)
  const userHoldings = accountIds.length
    ? await db.select().from(holdings).where(inArray(holdings.accountId, accountIds))
    : []

  const portfolioValue = userHoldings.reduce(
    (sum, h) => sum + Number(h.quantity) * Number(h.currentPrice), 0
  )
  const portfolioCost = userHoldings.reduce(
    (sum, h) => sum + Number(h.quantity) * Number(h.avgPrice), 0
  )
  const realEstateValue = userRealEstate.reduce((sum, r) => sum + Number(r.currentValue), 0)
  const totalIncome = monthIncome.reduce((sum, i) => sum + Number(i.amount), 0)
  const totalExpenses = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return NextResponse.json({
    netWorth: portfolioValue + realEstateValue,
    portfolioValue,
    portfolioGainLoss: portfolioValue - portfolioCost,
    portfolioGainLossPct: portfolioCost > 0 ? ((portfolioValue - portfolioCost) / portfolioCost) * 100 : 0,
    realEstateValue,
    monthlyIncome: totalIncome,
    monthlyExpenses: totalExpenses,
    monthlySavings: totalIncome - totalExpenses,
  })
}
