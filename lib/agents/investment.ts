import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `당신은 가족 포트폴리오 투자분석 전문가입니다. 보유 종목의 수익률, 자산배분,
집중도 리스크를 분석하고 리밸런싱이 필요한 경우 구체적인 방향을 제시합니다.
단순 정보 나열이 아닌 인사이트 중심으로 분석하세요.`

export async function runInvestmentAgent(prompt: string, userId: string): Promise<string> {
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
  return (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
}
