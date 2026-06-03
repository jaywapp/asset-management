import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { recurringTemplates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select().from(recurringTemplates)
    .where(eq(recurringTemplates.userId, session.user.id))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(recurringTemplates).values({
    userId: session.user.id,
    category: body.category,
    description: body.description,
    paymentMethodId: body.paymentMethodId ?? null,
    amountType: body.amountType,
    estimatedAmount: body.estimatedAmount ?? null,
    fixedAmount: body.fixedAmount ?? null,
    dayOfMonth: body.dayOfMonth ?? null,
    isActive: true,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
