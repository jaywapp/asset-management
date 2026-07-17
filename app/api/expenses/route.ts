import { CACHE_SHORT } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses } from '@/lib/db/schema'
import { eq, and, gte, inArray, isNull, lt } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const monthStart = new Date(year, month - 1, 1)
  const nextMonthStart = new Date(year, month, 1)
  const paymentMethodId = searchParams.get('paymentMethodId')
  const transferType = searchParams.get('transferType')
  const familyUserIds = await getFamilyUserIds(session.user.id)

  const conditions = [
    inArray(expenses.userId, familyUserIds),
    gte(expenses.date, monthStart),
    lt(expenses.date, nextMonthStart),
  ]
  if (paymentMethodId) conditions.push(eq(expenses.paymentMethodId, paymentMethodId))
  if (transferType === 'none') conditions.push(isNull(expenses.transferType))
  if (transferType === 'internal') conditions.push(eq(expenses.transferType, 'internal'))
  if (transferType === 'external') conditions.push(eq(expenses.transferType, 'external'))

  const rows = await db.select().from(expenses).where(and(...conditions))
  return NextResponse.json(rows, {
    headers: CACHE_SHORT,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(expenses).values({
    userId: session.user.id,
    category: body.category,
    amount: body.amount,
    description: body.description,
    date: new Date(body.date),
    isFixed: body.isFixed ?? false,
    isRecurring: body.isRecurring ?? false,
    paymentMethodId: body.paymentMethodId ?? null,
    transferType: body.transferType ?? null,
    transferToId: body.transferToId ?? null,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
