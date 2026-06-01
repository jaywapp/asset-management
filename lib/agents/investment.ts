import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'
import { getAgentPrompt } from './prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runInvestmentAgent(prompt: string, userId: string): Promise<string> {
  const system = await getAgentPrompt('investment')
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 2048, system, tools: agentTools, messages,
  })
  while (response.stop_reason === 'tool_use') {
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const t of response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]) {
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: await executeToolCall(t.name, t.input as Record<string, unknown>, userId) })
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
    response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2048, system, tools: agentTools, messages })
  }
  return (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
}
