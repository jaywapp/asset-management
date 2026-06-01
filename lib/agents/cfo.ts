import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `당신은 가족 자산관리 CFO입니다. 포트폴리오, 부동산, 현금흐름 데이터를 조회하여
명확하고 실용적인 한국어 분석을 제공합니다. 숫자는 한국 원화(₩) 형식으로 표시하고,
전문 용어보다 이해하기 쉬운 표현을 사용하세요.`

export async function runCFOAgent(prompt: string, userId: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]

  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM,
    tools: agentTools,
    messages,
  })

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const t of toolUseBlocks) {
      const result = await executeToolCall(t.name, t.input as Record<string, unknown>, userId)
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: result })
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM,
      tools: agentTools,
      messages,
    })
  }

  return (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
}

export async function saveCFOReport(content: string, type: 'daily' | 'weekly' | 'monthly' | 'on_demand') {
  await db.insert(aiReports).values({ type, agent: 'cfo', content })
}
