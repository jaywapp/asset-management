import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseWoori(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('거래일자') && l.includes('적요')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).flatMap(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, , desc, out, inp] = cols
    const outAmt = parseKrAmount(out)
    const inAmt = parseKrAmount(inp)
    if (outAmt === 0 && inAmt === 0) return []

    return [{
      date: parseKrDate(date),
      amount: outAmt > 0 ? outAmt : inAmt,
      type: (outAmt > 0 ? 'expense' : 'income') as 'expense' | 'income',
      description: desc,
      confidence: 'low' as const,
      tempId: createId(),
    }]
  })
}
