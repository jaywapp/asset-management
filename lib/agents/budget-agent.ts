import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `당신은 가족 재무흐름 분석가입니다. 수입과 지출 패턴을 분석하고
저축률 개선을 위한 실용적이고 구체적인 제안을 제공합니다.`

export async function runBudgetAgent(userId: string): Promise<string> {
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const prompt = `${prevYear}년 ${prevMonth}월 가계부를 결산하고 다음달 예산 제안을 해주세요.
수입/지출 분석, 저축률, 개선 포인트를 포함해주세요.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 2048, system: SYSTEM, tools: agentTools, messages,
  })
  while (response.stop_reason === 'tool_use') {
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const t of response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]) {
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: await executeToolCall(t.name, t.input as Record<string, unknown>, userId) })
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
    response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2048, system: SYSTEM, tools: agentTools, messages })
  }
  const content = (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
  await db.insert(aiReports).values({ type: 'monthly', agent: 'budget', content })
  return content
}
