import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runCFOAgent } from '@/lib/agents/cfo'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
  const reply = await runCFOAgent(message, session.user.id)
  return NextResponse.json({ content: reply })
}
