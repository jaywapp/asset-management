import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { holdings, accounts } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import yahooFinance from 'yahoo-finance2'

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userAccounts = await db.select({ id: accounts.id })
    .from(accounts).where(eq(accounts.userId, session.user.id))
  const accountIds = userAccounts.map(a => a.id)
  if (!accountIds.length) return NextResponse.json({ updated: 0 })

  const userHoldings = await db.select().from(holdings)
    .where(inArray(holdings.accountId, accountIds))
  if (!userHoldings.length) return NextResponse.json({ updated: 0 })

  const symbols = [...new Set(userHoldings.map(h => h.ticker))]

  const results = await Promise.allSettled(
    symbols.map(async symbol => {
      const quote = await yahooFinance.quote(symbol, {}, { validateResult: false }) as Record<string, unknown>
      const price = (quote.regularMarketPrice ?? quote.currentPrice ?? null) as number | null
      return { symbol, price }
    })
  )

  const priceMap: Record<string, number> = {}
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.price != null) {
      priceMap[result.value.symbol] = result.value.price
    }
  }

  let updated = 0
  for (const holding of userHoldings) {
    const price = priceMap[holding.ticker]
    if (price != null) {
      await db.update(holdings)
        .set({ currentPrice: String(price), updatedAt: new Date() })
        .where(eq(holdings.id, holding.id))
      updated++
    }
  }

  return NextResponse.json({ updated, total: userHoldings.length, priceMap })
}
