import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses, paymentMethods } from '@/lib/db/schema'
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const [hubResults, transferRows] = await Promise.all([
    db.select().from(paymentMethods).where(eq(paymentMethods.isHub, true)).limit(1),
    db.select().from(expenses).where(and(
      eq(expenses.userId, session.user.id),
      gte(expenses.date, monthStart),
      lte(expenses.date, monthEnd),
      isNotNull(expenses.transferType),
    )),
  ])

  const allMethods = await db.select().from(paymentMethods)
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
