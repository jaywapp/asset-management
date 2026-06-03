import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { paymentMethods } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(paymentMethods).where(
    or(eq(paymentMethods.userId, session.user.id), eq(paymentMethods.isShared, true))
  )
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(paymentMethods).values({
    userId: session.user.id,
    name: body.name,
    type: body.type,
    institution: body.institution,
    owner: body.owner ?? 'husband',
    isShared: body.isShared ?? false,
    isHub: false,
    accountNumber: body.accountNumber,
    color: body.color,
    linkedBankId: body.linkedBankId,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
