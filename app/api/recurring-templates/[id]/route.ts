import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { recurringTemplates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  if (body.category !== undefined) updateData.category = body.category
  if (body.description !== undefined) updateData.description = body.description
  if (body.paymentMethodId !== undefined) updateData.paymentMethodId = body.paymentMethodId
  if (body.amountType !== undefined) updateData.amountType = body.amountType
  if (body.estimatedAmount !== undefined) updateData.estimatedAmount = body.estimatedAmount
  if (body.fixedAmount !== undefined) updateData.fixedAmount = body.fixedAmount
  if (body.dayOfMonth !== undefined) updateData.dayOfMonth = body.dayOfMonth
  if (body.isActive !== undefined) updateData.isActive = body.isActive

  const [row] = await db.update(recurringTemplates)
    .set(updateData)
    .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, session.user.id)))
    .returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.delete(recurringTemplates)
    .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, session.user.id)))
  return new NextResponse(null, { status: 204 })
}
