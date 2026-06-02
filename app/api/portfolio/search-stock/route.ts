import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const EXCHANGE_LABELS: Record<string, string> = {
  KSC: 'KOSPI', KOE: 'KOSDAQ', NMS: 'NASDAQ', NYQ: 'NYSE', PCX: 'ETF(US)', KSE: 'KOSPI',
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=ko-KR&region=KR&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json([])

    const data = await res.json()
    const quotes = (data.quotes ?? []) as {
      symbol: string
      shortname?: string
      longname?: string
      exchange?: string
      quoteType?: string
    }[]

    const filtered = quotes
      .filter(q => q.symbol && q.quoteType !== 'FUTURE' && q.quoteType !== 'CURRENCY')
      .map(q => ({
        symbol: q.symbol,
        name: q.shortname ?? q.longname ?? q.symbol,
        exchange: EXCHANGE_LABELS[q.exchange ?? ''] ?? q.exchange ?? '',
        type: q.quoteType ?? '',
      }))

    return NextResponse.json(filtered)
  } catch {
    return NextResponse.json([])
  }
}
