import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ name: user.name, email: user.email, role: user.role })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: { name?: string; hashedPassword?: string } = {}

  if (body.name?.trim()) {
    updates.name = body.name.trim()
  }

  if (body.currentPassword && body.newPassword) {
    const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const valid = await bcrypt.compare(body.currentPassword, user.hashedPassword)
    if (!valid) return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다' }, { status: 400 })
    if (body.newPassword.length < 4) return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다' }, { status: 400 })
    updates.hashedPassword = await bcrypt.hash(body.newPassword, 10)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다' }, { status: 400 })
  }

  await db.update(users).set(updates).where(eq(users.id, session.user.id))
  return NextResponse.json({ success: true })
}
