import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.category !== undefined) update.category = body.category
  if (body.amount !== undefined) update.amount = body.amount
  if (body.description !== undefined) update.description = body.description
  if (body.date !== undefined) update.date = new Date(body.date)
  if (body.isFixed !== undefined) update.isFixed = body.isFixed
  if (body.transferType !== undefined) update.transferType = body.transferType
  if (body.transferToId !== undefined) update.transferToId = body.transferToId
  const [row] = await db.update(expenses).set(update)
    .where(and(eq(expenses.id, id), eq(expenses.userId, session.user.id)))
    .returning()
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, session.user.id)))
  return NextResponse.json({ success: true })
}
