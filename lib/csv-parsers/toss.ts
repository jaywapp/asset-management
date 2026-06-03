import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseToss(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('날짜') && l.includes('구분')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).flatMap(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, , type, desc, amount] = cols
    const amt = parseKrAmount(amount)
    if (amt === 0) return []

    const isOut = type.includes('출금')
    return [{
      date: parseKrDate(date),
      amount: amt,
      type: (isOut ? 'expense' : 'income') as 'expense' | 'income',
      description: desc,
      confidence: 'low' as const,
      tempId: createId(),
    }]
  })
}
