import { CACHE_SHORT } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { holdings, accounts } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { getFamilyUserIds } from '@/lib/family'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const familyUserIds = await getFamilyUserIds(session.user.id)
  const userAccounts = await db.select({ id: accounts.id })
    .from(accounts).where(inArray(accounts.userId, familyUserIds))
  const accountIds = userAccounts.map(a => a.id)
  if (!accountIds.length) return NextResponse.json([])

  const rows = await db.select().from(holdings).where(inArray(holdings.accountId, accountIds))
  return NextResponse.json(rows, {
    headers: CACHE_SHORT,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const allowedAccountIds = new Set(
    (await db.select({ id: accounts.id }).from(accounts).where(inArray(accounts.userId, familyUserIds)))
      .map((row) => row.id),
  )
  if (!allowedAccountIds.has(body.accountId)) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
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
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const familyUserIds = await getFamilyUserIds(session.user.id)
  const familyAccounts = await db.select({ id: accounts.id }).from(accounts)
    .where(inArray(accounts.userId, familyUserIds))
  const familyHoldings = familyAccounts.length > 0
    ? await db.select({ id: holdings.id }).from(holdings)
      .where(inArray(holdings.accountId, familyAccounts.map((account) => account.id)))
    : []
  if (!familyHoldings.some((holding) => holding.id === body.id)) {
    return NextResponse.json({ error: 'Holding not found' }, { status: 404 })
  }
  const [row] = await db.update(holdings)
    .set({ currentPrice: body.currentPrice, updatedAt: new Date() })
    .where(eq(holdings.id, body.id))
    .returning()
  return NextResponse.json(row)
}
