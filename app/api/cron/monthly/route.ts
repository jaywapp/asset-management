import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, expenses, recurringTemplates } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { runBudgetAgent } from '@/lib/agents/budget-agent'
import { createId } from '@paralleldrive/cuid2'

export const dynamic = 'force-dynamic'

async function runMonthly(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const allUsers = await db.select({ id: users.id }).from(users)
  for (const user of allUsers) {
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
  }

  const representative = allUsers[0]
  if (representative) await runBudgetAgent(representative.id)

  return NextResponse.json({ success: true, familiesProcessed: representative ? 1 : 0 })
}

export const GET = runMonthly
export const POST = runMonthly
