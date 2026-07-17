import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runCFOAgent } from '@/lib/agents/cfo'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { message } = await req.json()
  if (typeof message !== 'string' || !message.trim() || message.length > 10_000) {
    return NextResponse.json({ error: 'Message must be between 1 and 10000 characters' }, { status: 400 })
  }
  const reply = await runCFOAgent(message.trim(), session.user.id)
  return NextResponse.json({ content: reply })
}
