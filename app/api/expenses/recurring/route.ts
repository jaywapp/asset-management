import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses } from '@/lib/db/schema'
import { eq, and, gte, lte, lt } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// GET: 이번 달에 아직 적용되지 않은 반복 고정지출 목록 반환
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  // 이번 달에 이미 있는 반복 고정지출 description 목록
  const existing = await db.select().from(expenses).where(and(
    eq(expenses.userId, session.user.id),
    eq(expenses.isRecurring, true),
    gte(expenses.date, monthStart),
    lte(expenses.date, monthEnd),
  ))

  const existingDescriptions = new Set(existing.map(e => `${e.category}::${e.description ?? ''}`))

  // 이전 달들에서 가장 최근 반복 고정지출 (이번 달 이전)
  const prevRecurring = await db.select().from(expenses).where(and(
    eq(expenses.userId, session.user.id),
    eq(expenses.isRecurring, true),
    lt(expenses.date, monthStart),
  ))

  // 각 항목의 가장 최근 버전만 추출 (category+description 기준)
  const latestMap = new Map<string, typeof prevRecurring[0]>()
  for (const row of prevRecurring) {
    const key = `${row.category}::${row.description ?? ''}`
    const existing = latestMap.get(key)
    if (!existing || new Date(row.date) > new Date(existing.date)) {
      latestMap.set(key, row)
    }
  }

  // 이번 달에 아직 없는 항목만 반환
  const pending = Array.from(latestMap.values()).filter(
    row => !existingDescriptions.has(`${row.category}::${row.description ?? ''}`)
  )

  return NextResponse.json(pending)
}

// POST: 반복 고정지출을 이번 달에 일괄 적용
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { year, month, items } = await req.json() as {
    year: number
    month: number
    items: { category: string; amount: string; description: string | null }[]
  }

  // 이번 달 1일 날짜로 일괄 생성
  const targetDate = new Date(year, month - 1, 1)

  const rows = await db.insert(expenses).values(
    items.map(item => ({
      id: createId(),
      userId: session.user.id,
      category: item.category as any,
      amount: item.amount,
      description: item.description,
      date: targetDate,
      isFixed: true,
      isRecurring: true,
    }))
  ).returning()

  return NextResponse.json(rows, { status: 201 })
}
