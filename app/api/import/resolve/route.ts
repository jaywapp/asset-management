import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { ParsedEntry } from '@/lib/csv-parsers/types'

interface Answer {
  tempId: string
  category?: string
  transferType?: 'internal' | 'external'
  transferToId?: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uncertain, answers }: { uncertain: ParsedEntry[]; answers: Answer[] } = await req.json()

  const resolved: ParsedEntry[] = uncertain.map(entry => {
    const answer = answers.find(a => a.tempId === entry.tempId)
    if (!answer) return entry
    return {
      ...entry,
      category: (answer.category as ParsedEntry['category']) ?? entry.category,
      transferType: answer.transferType ?? entry.transferType,
      confidence: 'high' as const,
      question: undefined,
      options: undefined,
    }
  })

  const stillUncertain = resolved.filter(e => e.confidence === 'low')
  const nowConfirmed = resolved.filter(e => e.confidence === 'high')

  return NextResponse.json({ confirmed: nowConfirmed, uncertain: stillUncertain })
}
