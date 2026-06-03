import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseSamsung(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('이용일')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).map(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, merchant, amount] = cols
    return {
      date: parseKrDate(date),
      amount: parseKrAmount(amount),
      type: 'expense' as const,
      description: merchant,
      confidence: 'low' as const,
      tempId: createId(),
    }
  }).filter(e => e.amount > 0)
}
