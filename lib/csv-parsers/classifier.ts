import Anthropic from '@anthropic-ai/sdk'
import { createId } from '@paralleldrive/cuid2'
import type { ParsedEntry } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function classifyEntries(
  entries: ParsedEntry[],
  paymentMethodId: string
): Promise<{ confirmed: ParsedEntry[]; uncertain: ParsedEntry[] }> {
  if (entries.length === 0) return { confirmed: [], uncertain: [] }

  const prompt = `다음 거래 내역들을 분석하여 각 항목을 분류해주세요.

거래 내역:
${entries.map((e, i) => `${i}. [${e.date}] ${e.description} ${e.amount.toLocaleString()}원 (${e.type})`).join('\n')}

각 항목에 대해 JSON 배열로 반환하세요:
[{
  "index": 0,
  "category": "food|transport|housing|medical|education|leisure|subscription|other|salary|bonus|dividend|rental|freelance",
  "transferType": null,
  "confidence": "high" | "low",
  "question": "불확실한 경우 사용자에게 물어볼 질문",
  "options": ["선택지1", "선택지2"]
}]

분류 기준:
- 은행 이체/송금이면 transferType을 추론. 내 계좌로 이동은 "internal" 의심, 외부는 "external" 의심.
- 가맹점명이 명확하면 confidence "high", 이체나 애매하면 "low"
- "low"인 항목만 question과 options 작성

반드시 유효한 JSON 배열만 반환하세요.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) {
    return { confirmed: [], uncertain: entries.map(e => ({ ...e, confidence: 'low' as const })) }
  }

  const classifications: Array<{
    index: number
    category?: string
    transferType?: 'internal' | 'external' | null
    confidence: 'high' | 'low'
    question?: string
    options?: string[]
  }> = JSON.parse(match[0])

  const confirmed: ParsedEntry[] = []
  const uncertain: ParsedEntry[] = []

  entries.forEach((entry, i) => {
    const cls = classifications.find(c => c.index === i)
    const enriched: ParsedEntry = {
      ...entry,
      tempId: entry.tempId || createId(),
      category: (cls?.category as ParsedEntry['category']) ?? undefined,
      transferType: cls?.transferType ?? undefined,
      confidence: cls?.confidence ?? 'low',
      question: cls?.question,
      options: cls?.options,
    }
    if (enriched.confidence === 'high') {
      confirmed.push(enriched)
    } else {
      uncertain.push(enriched)
    }
  })

  return { confirmed, uncertain }
}
