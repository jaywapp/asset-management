import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { realEstate } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select().from(realEstate).where(eq(realEstate.userId, session.user.id))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(realEstate).values({
    userId: session.user.id,
    name: body.name,
    address: body.address,
    purchasePrice: body.purchasePrice,
    currentValue: body.currentValue,
    purchaseDate: new Date(body.purchaseDate),
    monthlyRentalIncome: body.monthlyRentalIncome ?? '0',
    propertyTax: body.propertyTax ?? '0',
  }).returning()
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.update(realEstate)
    .set({ currentValue: body.currentValue })
    .where(eq(realEstate.id, body.id))
    .returning()
  return NextResponse.json(row)
}
