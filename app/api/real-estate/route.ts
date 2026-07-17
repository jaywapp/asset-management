import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { realEstate } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const rows = await db.select().from(realEstate).where(inArray(realEstate.userId, familyUserIds))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const [row] = await db.update(realEstate)
    .set({ currentValue: body.currentValue })
    .where(and(eq(realEstate.id, body.id), inArray(realEstate.userId, familyUserIds)))
    .returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
