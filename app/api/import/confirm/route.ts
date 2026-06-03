import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses, income } from '@/lib/db/schema'
import type { ParsedEntry } from '@/lib/csv-parsers/types'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entries, paymentMethodId }: { entries: ParsedEntry[]; paymentMethodId: string } = await req.json()

  const expenseEntries = entries.filter(e => e.type === 'expense' || e.type === 'transfer')
  const incomeEntries = entries.filter(e => e.type === 'income')

  const [savedExpenses, savedIncome] = await Promise.all([
    expenseEntries.length > 0
      ? db.insert(expenses).values(expenseEntries.map(e => ({
          userId: session.user.id,
          category: (e.category as any) ?? 'other',
          amount: String(e.amount),
          description: e.description,
          date: new Date(e.date),
          isFixed: false,
          isRecurring: false,
          paymentMethodId,
          transferType: e.transferType ?? null,
          transferToId: null,
        }))).returning()
      : Promise.resolve([]),
    incomeEntries.length > 0
      ? db.insert(income).values(incomeEntries.map(e => ({
          userId: session.user.id,
          category: (e.category as any) ?? 'other',
          amount: String(e.amount),
          description: e.description,
          date: new Date(e.date),
          isRecurring: false,
          paymentMethodId,
        }))).returning()
      : Promise.resolve([]),
  ])

  return NextResponse.json({ saved: savedExpenses.length + savedIncome.length })
}
