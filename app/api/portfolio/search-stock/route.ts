import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

interface StockItem {
  symbol: string
  name: string
  exchange: string
  type: string
}

// ETF 브랜드명 접두사로 구분
const ETF_PREFIXES = ['KODEX', 'TIGER', 'ARIRANG', 'KBSTAR', 'HANARO', 'KOSEF', 'MASTER', 'SOL', 'ACE', 'PLUS', 'FOCUS', 'TREX', 'TIMEFOLIO', 'VITA']

function isEtfName(name: string) {
  const upper = name.toUpperCase()
  return ETF_PREFIXES.some(p => upper.startsWith(p))
}

// Naver autocomplete API — 국내 주식/ETF 한글명 검색
async function searchNaver(q: string): Promise<StockItem[]> {
  const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Referer': 'https://m.stock.naver.com/',
    },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return []

  const data = await res.json() as {
    items?: {
      code: string
      name: string
      typeCode?: string   // KOSPI | KOSDAQ
      typeName?: string
      category?: string
    }[]
  }

  return (data.items ?? []).map(item => {
    const isKosdaq = item.typeCode === 'KOSDAQ' || item.typeName?.includes('코스닥')
    const symbol = isKosdaq ? `${item.code}.KQ` : `${item.code}.KS`
    const exchange = isKosdaq ? '코스닥' : '코스피'
    const type = isEtfName(item.name) ? 'ETF' : '주식'

    return { symbol, name: item.name, exchange, type }
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
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])

  try {
    // 네이버 먼저 시도 (한글명 + 종목코드 + 영문 종목명 모두 처리)
    const naverResults = await searchNaver(q)
    if (naverResults.length > 0) {
      return NextResponse.json(naverResults.slice(0, 12))
    }

    // 네이버 결과 없으면 Yahoo (해외 주식/ETF)
    const yahooResults = await searchYahoo(q)
    return NextResponse.json(yahooResults.slice(0, 12))
  } catch {
    return NextResponse.json([])
  }
}
