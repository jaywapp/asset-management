import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { holdings, accounts } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { isDomestic, toNaverCode } from '@/lib/stock-utils'

async function fetchNaverPrice(code: string): Promise<number | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://m.stock.naver.com/',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as { closePrice?: string }
    if (!data.closePrice) return null
    // closePrice는 "356,500" 형태 → 숫자 변환
    return parseFloat(data.closePrice.replace(/,/g, ''))
  } catch {
    return null
  }
}

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) return null
    const data = await res.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number } }[] } }
    return data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch {
    return null
  }
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userAccounts = await db.select({ id: accounts.id })
    .from(accounts).where(eq(accounts.userId, session.user.id))
  const accountIds = userAccounts.map(a => a.id)
  if (!accountIds.length) return NextResponse.json({ updated: 0, total: 0 })

  const userHoldings = await db.select().from(holdings)
    .where(inArray(holdings.accountId, accountIds))
  if (!userHoldings.length) return NextResponse.json({ updated: 0, total: 0 })

  const symbols = [...new Set(userHoldings.map(h => h.ticker))]

  const results = await Promise.allSettled(
    symbols.map(async symbol => {
      const price = isDomestic(symbol)
        ? await fetchNaverPrice(toNaverCode(symbol))
        : await fetchYahooPrice(symbol)
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
