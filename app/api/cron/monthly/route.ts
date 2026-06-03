import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, expenses, recurringTemplates } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { runBudgetAgent } from '@/lib/agents/budget-agent'
import { createId } from '@paralleldrive/cuid2'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const allUsers = await db.select({ id: users.id }).from(users)
  const processed = new Set<string>()

  for (const user of allUsers) {
    if (processed.has(user.id)) continue
    processed.add(user.id)

    const templates = await db.select().from(recurringTemplates)
      .where(and(eq(recurringTemplates.userId, user.id), eq(recurringTemplates.isActive, true)))

    for (const tmpl of templates) {
      const existing = await db.select({ id: expenses.id }).from(expenses)
        .where(and(
          eq(expenses.userId, user.id),
          eq(expenses.recurringTemplateId, tmpl.id),
          gte(expenses.date, monthStart),
          lte(expenses.date, monthEnd),
        ))
      if (existing.length > 0) continue

      const lastDay = monthEnd.getDate()
      const day = Math.min(tmpl.dayOfMonth ?? 1, lastDay)
      const targetDate = new Date(year, month - 1, day)

      await db.insert(expenses).values({
        id: createId(),
        userId: user.id,
        category: tmpl.category,
        amount: tmpl.amountType === 'fixed' ? (tmpl.fixedAmount ?? '0') : '0',
        description: tmpl.description,
        date: targetDate,
        isFixed: true,
        isRecurring: true,
        paymentMethodId: tmpl.paymentMethodId,
        recurringTemplateId: tmpl.id,
      })
    }

    await runBudgetAgent(user.id)
  }

  return NextResponse.json({ success: true })
}
