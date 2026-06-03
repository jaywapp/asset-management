export type ExpenseCategory = 'food' | 'transport' | 'housing' | 'medical' | 'education' | 'leisure' | 'subscription' | 'other'
export type IncomeCategory = 'salary' | 'bonus' | 'dividend' | 'rental' | 'freelance' | 'other'

export interface ParsedEntry {
  date: string           // YYYY-MM-DD
  amount: number         // always positive
  type: 'income' | 'expense' | 'transfer'
  description: string
  category?: ExpenseCategory | IncomeCategory
  transferType?: 'internal' | 'external'
  confidence: 'high' | 'low'
  question?: string      // AI-generated question for uncertain items
  options?: string[]     // multiple choice options
  tempId: string         // client-side tracking ID
}

export interface ImportSession {
  confirmed: ParsedEntry[]
  uncertain: ParsedEntry[]
  paymentMethodId: string
}

export type CsvParser = (csvText: string) => ParsedEntry[]
