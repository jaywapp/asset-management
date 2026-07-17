import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateCashFlow,
  calculateNetWorth,
  convertToKrw,
  isRealExpense,
  sumRealExpenses,
} from './calculations'

test('internal transfers are excluded from spending', () => {
  const total = sumRealExpenses([
    { amount: 50_000, transferType: null },
    { amount: 300_000, transferType: 'internal' },
    { amount: 100_000, transferType: 'external' },
  ])

  assert.equal(total, 150_000)
})

test('external transfers remain real expenses', () => {
  assert.equal(isRealExpense('external'), true)
  assert.equal(isRealExpense('internal'), false)
  assert.equal(isRealExpense(null), true)
})

test('cash flow uses only real expenses', () => {
  const result = calculateCashFlow(
    [{ amount: '1000000' }, { amount: 500_000 }],
    [
      { amount: '250000', transferType: null },
      { amount: '400000', transferType: 'internal' },
    ],
  )

  assert.equal(result.income, 1_500_000)
  assert.equal(result.expenses, 250_000)
  assert.equal(result.savings, 1_250_000)
  assert.equal(result.savingsRate.toFixed(1), '83.3')
})

test('foreign currency values are converted to KRW', () => {
  assert.equal(convertToKrw('1000', '1385.5'), 1_385_500)
})

test('net worth subtracts liabilities from registered assets', () => {
  assert.deepEqual(calculateNetWorth({
    portfolioValue: 200_000_000,
    cashBalance: 50_000_000,
    realEstateValue: 600_000_000,
    liabilities: 300_000_000,
  }), {
    registeredAssets: 850_000_000,
    netWorth: 550_000_000,
  })
})
