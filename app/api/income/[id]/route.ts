import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { income } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.delete(income).where(and(eq(income.id, id), eq(income.userId, session.user.id)))
  return NextResponse.json({ success: true })
}
