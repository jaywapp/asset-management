import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

interface StockItem {
  symbol: string
  name: string
  exchange: string
  type: string
}

// 한국어 포함 또는 6자리 숫자 → 네이버 금융 사용
function isKoreanQuery(q: string) {
  return /[가-힣]/.test(q) || /^\d{4,6}$/.test(q)
}

// KOSPI/KOSDAQ 코드를 Yahoo Finance 심볼로 변환
function toYahooSymbol(code: string, isKosdaq: boolean): string {
  return isKosdaq ? `${code}.KQ` : `${code}.KS`
}

async function searchNaver(q: string): Promise<StockItem[]> {
  const url = `https://m.stock.naver.com/api/search/all?keyword=${encodeURIComponent(q)}&page=1&pageSize=15`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Referer': 'https://m.stock.naver.com/',
    },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return []

  const data = await res.json()
  const stocks = (data.stocks ?? data.items ?? []) as {
    itemCode?: string; reutersCode?: string; symbolCode?: string
    itemName?: string; name?: string
    stockExchangeType?: { code?: string; name?: string }
    marketType?: string
    itemType?: string; type?: string
  }[]

  return stocks.map(s => {
    const code = s.itemCode ?? s.reutersCode ?? s.symbolCode ?? ''
    const name = s.itemName ?? s.name ?? ''
    const market = s.stockExchangeType?.name ?? s.marketType ?? '코스피'
    const marketCode = s.stockExchangeType?.code ?? ''
    const type = s.itemType ?? s.type ?? 'STOCK'

    const isKosdaq = market.includes('코스닥') || marketCode === 'KOE' || marketCode === 'KOSDAQ'
    const isNumeric = /^\d+$/.test(code)
    const symbol = isNumeric ? toYahooSymbol(code, isKosdaq) : code

    const exchangeLabel = market.includes('코스닥') ? '코스닥'
      : market.includes('코스피') ? '코스피'
      : market.includes('ETF') ? 'ETF'
      : market

    return {
      symbol,
      name,
      exchange: exchangeLabel,
      type: type === 'ETF' ? 'ETF' : '주식',
    }
  }).filter(s => s.name && s.symbol)
}

async function searchYahoo(q: string): Promise<StockItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=ko-KR&region=KR&quotesCount=10&newsCount=0`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return []

  const data = await res.json()
  const quotes = (data.quotes ?? []) as {
    symbol: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string
  }[]

  const EXCHANGE_LABELS: Record<string, string> = {
    NMS: 'NASDAQ', NYQ: 'NYSE', PCX: 'ETF(US)', KSC: '코스피', KOE: '코스닥',
  }

  return quotes
    .filter(q => q.symbol && q.quoteType !== 'FUTURE' && q.quoteType !== 'CURRENCY')
    .map(q => ({
      symbol: q.symbol,
      name: q.shortname ?? q.longname ?? q.symbol,
      exchange: EXCHANGE_LABELS[q.exchange ?? ''] ?? q.exchange ?? '',
      type: q.quoteType === 'ETF' ? 'ETF' : q.quoteType === 'EQUITY' ? '주식' : q.quoteType ?? '',
    }))
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])

  try {
    let results: StockItem[]

    if (isKoreanQuery(q)) {
      results = await searchNaver(q)
      if (!results.length) results = await searchYahoo(q)
    } else {
      results = await searchYahoo(q)
    }

    return NextResponse.json(results.slice(0, 12))
  } catch {
    return NextResponse.json([])
  }
}
