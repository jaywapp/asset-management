export type TransferType = 'internal' | 'external' | null | undefined

interface ExpenseAmount {
  amount: string | number
  transferType?: TransferType
}

export function isRealExpense(transferType: TransferType): boolean {
  return transferType !== 'internal'
}

export function sumAmounts(rows: ReadonlyArray<{ amount: string | number }>): number {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0)
}

export function sumRealExpenses(rows: ReadonlyArray<ExpenseAmount>): number {
  return rows.reduce(
    (sum, row) => sum + (isRealExpense(row.transferType) ? Number(row.amount) : 0),
    0,
  )
}

export function calculateCashFlow(
  incomeRows: ReadonlyArray<{ amount: string | number }>,
  expenseRows: ReadonlyArray<ExpenseAmount>,
) {
  const income = sumAmounts(incomeRows)
  const expenses = sumRealExpenses(expenseRows)
  const savings = income - expenses

  return {
    income,
    expenses,
    savings,
    savingsRate: income > 0 ? (savings / income) * 100 : 0,
  }
}

export function convertToKrw(amount: string | number, exchangeRateToKrw: string | number): number {
  return Number(amount) * Number(exchangeRateToKrw)
}

export function calculateNetWorth({
  portfolioValue,
  cashBalance,
  realEstateValue,
  liabilities,
}: {
  portfolioValue: number
  cashBalance: number
  realEstateValue: number
  liabilities: number
}) {
  const registeredAssets = portfolioValue + cashBalance + realEstateValue
  return {
    registeredAssets,
    netWorth: registeredAssets - liabilities,
  }
}
