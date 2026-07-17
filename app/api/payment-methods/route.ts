import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { paymentMethods } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const familyUserIds = await getFamilyUserIds(session.user.id)
  const rows = await db.select().from(paymentMethods)
    .where(inArray(paymentMethods.userId, familyUserIds))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const institution = typeof body.institution === 'string' ? body.institution.trim() : ''
  const validTypes = ['bank', 'credit_card', 'debit_card']
  const validOwners = ['husband', 'wife', 'joint']
  const balance = Number(body.balance ?? 0)
  const exchangeRateToKrw = Number(body.exchangeRateToKrw ?? 1)
  if (!name || !institution || !validTypes.includes(body.type) || !validOwners.includes(body.owner ?? 'husband')) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }
  if (!Number.isFinite(balance) || balance < 0 || !Number.isFinite(exchangeRateToKrw) || exchangeRateToKrw <= 0) {
    return NextResponse.json({ error: 'Balance and exchange rate must be valid positive numbers' }, { status: 400 })
  }
  let linkedBankId: string | null = null
  if (body.type !== 'bank' && body.linkedBankId) {
    const familyUserIds = await getFamilyUserIds(session.user.id)
    const [linkedBank] = await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(
        eq(paymentMethods.id, body.linkedBankId),
        eq(paymentMethods.type, 'bank'),
        inArray(paymentMethods.userId, familyUserIds),
      ))
    if (!linkedBank) return NextResponse.json({ error: 'Invalid linked bank' }, { status: 400 })
    linkedBankId = linkedBank.id
  }
  const [row] = await db.insert(paymentMethods).values({
    userId: session.user.id,
    name,
    type: body.type,
    institution,
    owner: body.owner ?? 'husband',
    isShared: body.isShared ?? false,
    isHub: false,
    accountNumber: body.accountNumber,
    color: body.color,
    linkedBankId,
    balance: body.type === 'bank' ? String(balance) : '0',
    currency: body.type === 'bank' && typeof body.currency === 'string'
      ? body.currency.trim().toUpperCase().slice(0, 3)
      : 'KRW',
    exchangeRateToKrw: body.type === 'bank' ? String(exchangeRateToKrw) : '1',
    includeInNetWorth: body.type === 'bank' ? body.includeInNetWorth !== false : false,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
