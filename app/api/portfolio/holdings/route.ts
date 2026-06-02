import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { holdings, accounts } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userAccounts = await db.select({ id: accounts.id })
    .from(accounts).where(eq(accounts.userId, session.user.id))
  const accountIds = userAccounts.map(a => a.id)
  if (!accountIds.length) return NextResponse.json([])

  const rows = await db.select().from(holdings).where(inArray(holdings.accountId, accountIds))
  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(holdings).values({
    accountId: body.accountId,
    ticker: body.ticker,
    name: body.name,
    quantity: body.quantity,
    avgPrice: body.avgPrice,
    currentPrice: body.currentPrice,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.update(holdings)
    .set({ currentPrice: body.currentPrice, updatedAt: new Date() })
    .where(eq(holdings.id, body.id))
    .returning()
  return NextResponse.json(row)
}
