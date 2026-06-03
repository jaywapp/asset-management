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

  const [row] = await db.update(paymentMethods)
    .set(updateData)
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
