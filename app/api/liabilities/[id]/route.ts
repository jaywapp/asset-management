import { and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { liabilities } from '@/lib/db/schema'
import { getFamilyUserIds } from '@/lib/family'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const balance = Number(body.balance)
  if (!Number.isFinite(balance) || balance < 0) {
    return NextResponse.json({ error: 'Balance must be zero or greater' }, { status: 400 })
  }
  const [row] = await db.update(liabilities)
    .set({ balance: String(balance) })
    .where(and(eq(liabilities.id, id), inArray(liabilities.userId, familyUserIds)))
    .returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const deleted = await db.delete(liabilities)
    .where(and(eq(liabilities.id, id), inArray(liabilities.userId, familyUserIds)))
    .returning({ id: liabilities.id })
  if (!deleted.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
