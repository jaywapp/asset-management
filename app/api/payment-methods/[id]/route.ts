import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { paymentMethods } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const [target] = await db.select({ id: paymentMethods.id }).from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), inArray(paymentMethods.userId, familyUserIds)))
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.balance !== undefined && (!Number.isFinite(Number(body.balance)) || Number(body.balance) < 0)) {
    return NextResponse.json({ error: 'Balance must be zero or greater' }, { status: 400 })
  }
  if (body.exchangeRateToKrw !== undefined
    && (!Number.isFinite(Number(body.exchangeRateToKrw)) || Number(body.exchangeRateToKrw) <= 0)) {
    return NextResponse.json({ error: 'Exchange rate must be greater than zero' }, { status: 400 })
  }
  if (body.linkedBankId) {
    const [linkedBank] = await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(
        eq(paymentMethods.id, body.linkedBankId),
        eq(paymentMethods.type, 'bank'),
        inArray(paymentMethods.userId, familyUserIds),
      ))
    if (!linkedBank) return NextResponse.json({ error: 'Invalid linked bank' }, { status: 400 })
  }

  // isHub 변경 시: 기존 허브 해제 후 신규 지정
  if (body.isHub === true) {
    await db.update(paymentMethods)
      .set({ isHub: false })
      .where(and(eq(paymentMethods.isHub, true), inArray(paymentMethods.userId, familyUserIds)))
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.type !== undefined) updateData.type = body.type
  if (body.institution !== undefined) updateData.institution = body.institution
  if (body.owner !== undefined) updateData.owner = body.owner
  if (body.isShared !== undefined) updateData.isShared = body.isShared
  if (body.isHub !== undefined) updateData.isHub = body.isHub
  if (body.accountNumber !== undefined) updateData.accountNumber = body.accountNumber
  if (body.color !== undefined) updateData.color = body.color
  if (body.linkedBankId !== undefined) updateData.linkedBankId = body.linkedBankId
  if (body.balance !== undefined) updateData.balance = String(Number(body.balance))
  if (body.currency !== undefined && typeof body.currency === 'string') {
    updateData.currency = body.currency.trim().toUpperCase().slice(0, 3)
  }
  if (body.exchangeRateToKrw !== undefined) updateData.exchangeRateToKrw = String(Number(body.exchangeRateToKrw))
  if (body.includeInNetWorth !== undefined) updateData.includeInNetWorth = Boolean(body.includeInNetWorth)

  const [row] = await db.update(paymentMethods)
    .set(updateData)
    .where(and(eq(paymentMethods.id, id), inArray(paymentMethods.userId, familyUserIds)))
    .returning()
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const deleted = await db.delete(paymentMethods)
    .where(and(eq(paymentMethods.id, id), inArray(paymentMethods.userId, familyUserIds)))
    .returning({ id: paymentMethods.id })
  if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
