import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `당신은 가족 포트폴리오 리스크 매니저입니다. 리스크를 명확하게 식별하고
실행 가능한 조언을 제공하세요. 문제가 없으면 간결하게 "이상 없음"으로 보고하세요.`

export async function runRiskAgent(userId: string): Promise<string> {
  const prompt = `현재 포트폴리오의 리스크를 점검해주세요:
1. 단일 종목이 전체의 20% 초과 여부
2. 자산 유형 집중도 문제
3. 주의가 필요한 사항`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1024, system: SYSTEM, tools: agentTools, messages,
  })
  while (response.stop_reason === 'tool_use') {
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const t of response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]) {
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: await executeToolCall(t.name, t.input as Record<string, unknown>, userId) })
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
    response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: SYSTEM, tools: agentTools, messages })
  }
  const content = (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
  await db.insert(aiReports).values({ type: 'daily', agent: 'risk', content })
  return content
}
