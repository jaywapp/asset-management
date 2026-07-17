import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses, paymentMethods } from '@/lib/db/schema'
import { and, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const monthStart = new Date(year, month - 1, 1)
  const nextMonthStart = new Date(year, month, 1)
  const familyUserIds = await getFamilyUserIds(session.user.id)

  const [hubResults, transferRows] = await Promise.all([
    db.select().from(paymentMethods).where(and(
      eq(paymentMethods.isHub, true),
      inArray(paymentMethods.userId, familyUserIds),
    )).limit(1),
    db.select().from(expenses).where(and(
      inArray(expenses.userId, familyUserIds),
      gte(expenses.date, monthStart),
      lt(expenses.date, nextMonthStart),
      isNotNull(expenses.transferType),
    )),
  ])

  const allMethods = await db.select().from(paymentMethods)
    .where(inArray(paymentMethods.userId, familyUserIds))
  const methodMap = Object.fromEntries(allMethods.map(m => [m.id, m]))

  const flows = transferRows.map(e => ({
    fromId: e.paymentMethodId,
    fromName: e.paymentMethodId ? (methodMap[e.paymentMethodId]?.name ?? '알 수 없음') : '알 수 없음',
    toId: e.transferType === 'internal' ? e.transferToId : null,
    toName: e.transferType === 'internal'
      ? (e.transferToId ? (methodMap[e.transferToId]?.name ?? '알 수 없음') : '알 수 없음')
      : (e.description ?? '외부'),
    amount: Number(e.amount),
    transferType: e.transferType,
    category: e.category,
  }))

  return NextResponse.json({ hub: hubResults[0] ?? null, flows })
}
