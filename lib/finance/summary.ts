import { and, gte, inArray, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  expenses,
  holdings,
  income,
  liabilities,
  paymentMethods,
  realEstate,
} from '@/lib/db/schema'
import { calculateCashFlow, calculateNetWorth, convertToKrw } from '@/lib/finance/calculations'
import { getFamilyUserIds } from '@/lib/family'

export interface AssetSummary {
  netWorth: number
  registeredAssets: number
  portfolioValue: number
  portfolioGainLoss: number
  portfolioGainLossPct: number
  realEstateValue: number
  cashBalance: number
  liabilities: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlySavings: number
  savingsRate: number
}

export async function getFamilyAssetSummary(
  currentUserId: string,
  now = new Date(),
): Promise<AssetSummary> {
  const familyUserIds = await getFamilyUserIds(currentUserId)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [familyAccounts, familyRealEstate, familyPaymentMethods, familyLiabilities, monthIncome, monthExpenses] = await Promise.all([
    db.select({ id: accounts.id, exchangeRateToKrw: accounts.exchangeRateToKrw })
      .from(accounts).where(inArray(accounts.userId, familyUserIds)),
    db.select().from(realEstate).where(inArray(realEstate.userId, familyUserIds)),
    db.select().from(paymentMethods).where(inArray(paymentMethods.userId, familyUserIds)),
    db.select().from(liabilities).where(inArray(liabilities.userId, familyUserIds)),
    db.select({ amount: income.amount }).from(income).where(and(
      inArray(income.userId, familyUserIds),
      gte(income.date, monthStart),
      lt(income.date, nextMonthStart),
    )),
    db.select({ amount: expenses.amount, transferType: expenses.transferType }).from(expenses).where(and(
      inArray(expenses.userId, familyUserIds),
      gte(expenses.date, monthStart),
      lt(expenses.date, nextMonthStart),
    )),
  ])

  const accountIds = familyAccounts.map((account) => account.id)
  const accountRates = new Map(
    familyAccounts.map((account) => [account.id, Number(account.exchangeRateToKrw)]),
  )
  const familyHoldings = accountIds.length > 0
    ? await db.select().from(holdings).where(inArray(holdings.accountId, accountIds))
    : []

  const portfolioValue = familyHoldings.reduce(
    (sum, holding) => sum + Number(holding.quantity) * Number(holding.currentPrice)
      * (accountRates.get(holding.accountId) ?? 1),
    0,
  )
  const portfolioCost = familyHoldings.reduce(
    (sum, holding) => sum + Number(holding.quantity) * Number(holding.avgPrice)
      * (accountRates.get(holding.accountId) ?? 1),
    0,
  )
  const realEstateValue = familyRealEstate.reduce(
    (sum, property) => sum + Number(property.currentValue),
    0,
  )
  const cashBalance = familyPaymentMethods
    .filter((method) => method.type === 'bank' && method.includeInNetWorth)
    .reduce(
      (sum, method) => sum + convertToKrw(method.balance, method.exchangeRateToKrw),
      0,
    )
  const liabilityTotal = familyLiabilities.reduce(
    (sum, liability) => sum + convertToKrw(liability.balance, liability.exchangeRateToKrw),
    0,
  )
  const netWorth = calculateNetWorth({
    portfolioValue,
    cashBalance,
    realEstateValue,
    liabilities: liabilityTotal,
  })
  const cashFlow = calculateCashFlow(monthIncome, monthExpenses)

  return {
    netWorth: netWorth.netWorth,
    registeredAssets: netWorth.registeredAssets,
    portfolioValue,
    portfolioGainLoss: portfolioValue - portfolioCost,
    portfolioGainLossPct: portfolioCost > 0
      ? ((portfolioValue - portfolioCost) / portfolioCost) * 100
      : 0,
    realEstateValue,
    cashBalance,
    liabilities: liabilityTotal,
    monthlyIncome: cashFlow.income,
    monthlyExpenses: cashFlow.expenses,
    monthlySavings: cashFlow.savings,
    savingsRate: cashFlow.savingsRate,
  }
}
