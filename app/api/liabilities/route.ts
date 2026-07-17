import { inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { liabilities } from '@/lib/db/schema'
import { getFamilyUserIds } from '@/lib/family'

const LIABILITY_TYPES = ['mortgage', 'credit_loan', 'lease_loan', 'card', 'other'] as const

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const rows = await db.select().from(liabilities)
    .where(inArray(liabilities.userId, familyUserIds))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const balance = Number(body.balance)
  const exchangeRateToKrw = Number(body.exchangeRateToKrw ?? 1)
  if (!name || !LIABILITY_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Invalid liability' }, { status: 400 })
  }
  if (!Number.isFinite(balance) || balance < 0 || !Number.isFinite(exchangeRateToKrw) || exchangeRateToKrw <= 0) {
    return NextResponse.json({ error: 'Balance and exchange rate must be valid positive numbers' }, { status: 400 })
  }
  const interestRate = body.interestRate === '' || body.interestRate == null ? null : Number(body.interestRate)
  const monthlyPayment = body.monthlyPayment === '' || body.monthlyPayment == null ? null : Number(body.monthlyPayment)
  const maturityDate = body.maturityDate ? new Date(body.maturityDate) : null
  if ((interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0))
    || (monthlyPayment !== null && (!Number.isFinite(monthlyPayment) || monthlyPayment < 0))
    || (maturityDate && Number.isNaN(maturityDate.getTime()))) {
    return NextResponse.json({ error: 'Invalid loan details' }, { status: 400 })
  }

  const [row] = await db.insert(liabilities).values({
    userId: session.user.id,
    name,
    type: body.type,
    institution: typeof body.institution === 'string' ? body.institution.trim() || null : null,
    balance: String(balance),
    currency: typeof body.currency === 'string' ? body.currency.trim().toUpperCase().slice(0, 3) : 'KRW',
    exchangeRateToKrw: String(exchangeRateToKrw),
    interestRate: interestRate === null ? null : String(interestRate),
    monthlyPayment: monthlyPayment === null ? null : String(monthlyPayment),
    maturityDate,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
