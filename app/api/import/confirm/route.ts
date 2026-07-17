import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses, income } from '@/lib/db/schema'
import type { ExpenseCategory, IncomeCategory, ParsedEntry } from '@/lib/csv-parsers/types'

const EXPENSE_CATEGORIES = new Set<ExpenseCategory>([
  'food', 'transport', 'housing', 'medical', 'education', 'leisure', 'subscription', 'other',
])
const INCOME_CATEGORIES = new Set<IncomeCategory>([
  'salary', 'bonus', 'dividend', 'rental', 'freelance', 'other',
])

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entries, paymentMethodId }: { entries: ParsedEntry[]; paymentMethodId: string } = await req.json()

  const expenseEntries = entries.filter(e => e.type === 'expense' || e.type === 'transfer')
  const incomeEntries = entries.filter(e => e.type === 'income')

  const [savedExpenses, savedIncome] = await Promise.all([
    expenseEntries.length > 0
      ? db.insert(expenses).values(expenseEntries.map(e => ({
          userId: session.user.id,
          category: EXPENSE_CATEGORIES.has(e.category as ExpenseCategory)
            ? e.category as ExpenseCategory
            : 'other',
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
          category: INCOME_CATEGORIES.has(e.category as IncomeCategory)
            ? e.category as IncomeCategory
            : 'other',
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
