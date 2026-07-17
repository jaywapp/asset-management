import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { paymentMethods, recurringTemplates } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

const EXPENSE_CATEGORIES = [
  'food', 'transport', 'housing', 'medical', 'education', 'leisure', 'subscription', 'other',
]

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const rows = await db.select().from(recurringTemplates)
    .where(inArray(recurringTemplates.userId, familyUserIds))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const amountType = body.amountType
  const dayOfMonth = body.dayOfMonth == null || body.dayOfMonth === '' ? null : Number(body.dayOfMonth)
  const fixedAmount = body.fixedAmount == null || body.fixedAmount === '' ? null : Number(body.fixedAmount)
  const estimatedAmount = body.estimatedAmount == null || body.estimatedAmount === ''
    ? null
    : Number(body.estimatedAmount)
  if (!description || !EXPENSE_CATEGORIES.includes(body.category)
    || !['fixed', 'variable'].includes(amountType)
    || (dayOfMonth !== null && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31))
    || (fixedAmount !== null && (!Number.isFinite(fixedAmount) || fixedAmount < 0))
    || (estimatedAmount !== null && (!Number.isFinite(estimatedAmount) || estimatedAmount < 0))) {
    return NextResponse.json({ error: 'Invalid recurring template' }, { status: 400 })
  }
  if (body.paymentMethodId) {
    const familyUserIds = await getFamilyUserIds(session.user.id)
    const [method] = await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(
        eq(paymentMethods.id, body.paymentMethodId),
        inArray(paymentMethods.userId, familyUserIds),
      ))
    if (!method) return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }
  const [row] = await db.insert(recurringTemplates).values({
    userId: session.user.id,
    category: body.category,
    description,
    paymentMethodId: body.paymentMethodId ?? null,
    amountType: body.amountType,
    estimatedAmount: estimatedAmount === null ? null : String(estimatedAmount),
    fixedAmount: fixedAmount === null ? null : String(fixedAmount),
    dayOfMonth,
    isActive: true,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
