import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { paymentMethods } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // isHub 변경 시: 기존 허브 해제 후 신규 지정
  if (body.isHub === true) {
    await db.update(paymentMethods)
      .set({ isHub: false })
      .where(eq(paymentMethods.isHub, true))
  }

  const [row] = await db.update(paymentMethods)
    .set({
      name: body.name,
      type: body.type,
      institution: body.institution,
      owner: body.owner,
      isShared: body.isShared,
      isHub: body.isHub,
      accountNumber: body.accountNumber,
      color: body.color,
      linkedBankId: body.linkedBankId,
    })
    .where(eq(paymentMethods.id, id))
    .returning()
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.delete(paymentMethods).where(eq(paymentMethods.id, id))
  return new NextResponse(null, { status: 204 })
}
