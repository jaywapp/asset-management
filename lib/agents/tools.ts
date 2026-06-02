import { db } from '@/lib/db'
import { accounts, holdings, realEstate, income, expenses } from '@/lib/db/schema'
import { eq, inArray, gte, lte, and } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

export type Tool = Anthropic.Tool

export const agentTools: Tool[] = [
  {
    name: 'get_portfolio_summary',
    description: '모든 보유 종목과 평가금액, 수익률을 조회한다',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_real_estate_summary',
    description: '보유 부동산 목록과 평가손익을 조회한다',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_monthly_cashflow',
    description: '특정 월의 수입과 지출 합계를 조회한다. 고정지출/변동지출 구분, 카테고리별 내역, 순저축 포함',
    input_schema: {
      type: 'object' as const,
      properties: {
        year: { type: 'number', description: '연도' },
        month: { type: 'number', description: '월 (1-12)' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'get_net_worth',
    description: '전체 순자산(금융+부동산) 합계를 조회한다',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
]

type ToolInput = Record<string, unknown>

export async function executeToolCall(name: string, input: ToolInput, userId: string): Promise<string> {
  if (name === 'get_portfolio_summary') {
    const userAccounts = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId))
    const ids = userAccounts.map(a => a.id)
    if (!ids.length) return JSON.stringify({ holdings: [], totalValue: 0 })
    const rows = await db.select().from(holdings).where(inArray(holdings.accountId, ids))
    const summary = rows.map(h => {
      const qty = Number(h.quantity)
      const value = qty * Number(h.currentPrice)
      const cost = qty * Number(h.avgPrice)
      return {
        ticker: h.ticker,
        name: h.name,
        value,
        gainLoss: value - cost,
        gainLossPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
      }
    })
    return JSON.stringify({ holdings: summary, totalValue: summary.reduce((s, h) => s + h.value, 0) })
  }

  if (name === 'get_real_estate_summary') {
    const rows = await db.select().from(realEstate).where(eq(realEstate.userId, userId))
    return JSON.stringify(rows.map(r => ({
      name: r.name,
      currentValue: Number(r.currentValue),
      gainLoss: Number(r.currentValue) - Number(r.purchasePrice),
      monthlyRental: Number(r.monthlyRentalIncome),
    })))
  }

  if (name === 'get_monthly_cashflow') {
    const { year, month } = input as { year: number; month: number }
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    const [inc, exp] = await Promise.all([
      db.select().from(income).where(and(eq(income.userId, userId), gte(income.date, start), lte(income.date, end))),
      db.select().from(expenses).where(and(eq(expenses.userId, userId), gte(expenses.date, start), lte(expenses.date, end))),
    ])
    const fixedExp = exp.filter(e => e.isFixed)
    const variableExp = exp.filter(e => !e.isFixed)
    return JSON.stringify({
      totalIncome: inc.reduce((s, i) => s + Number(i.amount), 0),
      totalExpenses: exp.reduce((s, e) => s + Number(e.amount), 0),
      totalFixedExpenses: fixedExp.reduce((s, e) => s + Number(e.amount), 0),
      totalVariableExpenses: variableExp.reduce((s, e) => s + Number(e.amount), 0),
      netSavings: inc.reduce((s, i) => s + Number(i.amount), 0) - exp.reduce((s, e) => s + Number(e.amount), 0),
      incomeByCategory: inc.reduce((acc: Record<string, number>, i) => { acc[i.category] = (acc[i.category] ?? 0) + Number(i.amount); return acc }, {}),
      expensesByCategory: exp.reduce((acc: Record<string, number>, e) => { acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount); return acc }, {}),
      fixedExpensesByCategory: fixedExp.reduce((acc: Record<string, number>, e) => { acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount); return acc }, {}),
      variableExpensesByCategory: variableExp.reduce((acc: Record<string, number>, e) => { acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount); return acc }, {}),
      fixedExpenseItems: fixedExp.map(e => ({ category: e.category, amount: Number(e.amount), description: e.description, isRecurring: e.isRecurring })),
    })
  }

  if (name === 'get_net_worth') {
    const userAccounts = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId))
    const ids = userAccounts.map(a => a.id)
    const [userHoldings, reList] = await Promise.all([
      ids.length ? db.select().from(holdings).where(inArray(holdings.accountId, ids)) : Promise.resolve([]),
      db.select().from(realEstate).where(eq(realEstate.userId, userId)),
    ])
    const portfolioValue = userHoldings.reduce((s, h) => s + Number(h.quantity) * Number(h.currentPrice), 0)
    const reValue = reList.reduce((s, r) => s + Number(r.currentValue), 0)
    return JSON.stringify({ portfolioValue, realEstateValue: reValue, netWorth: portfolioValue + reValue })
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` })
}
