import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { agentSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { DEFAULT_PROMPTS } from '@/lib/agents/prompts'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(agentSettings)
  const saved = Object.fromEntries(rows.map(r => [r.agentName, r.systemPrompt]))

  const result = Object.entries(DEFAULT_PROMPTS).map(([name, defaultPrompt]) => ({
    agentName: name,
    systemPrompt: saved[name] ?? defaultPrompt,
    isCustom: !!saved[name],
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentName, systemPrompt } = await req.json()
  if (!(agentName in DEFAULT_PROMPTS) || typeof systemPrompt !== 'string'
    || !systemPrompt.trim() || systemPrompt.length > 20_000) {
    return NextResponse.json({ error: 'agentName and systemPrompt required' }, { status: 400 })
  }

  const existing = await db.query.agentSettings.findFirst({
    where: eq(agentSettings.agentName, agentName),
  })

  if (existing) {
    await db.update(agentSettings)
      .set({ systemPrompt, updatedAt: new Date() })
      .where(eq(agentSettings.agentName, agentName))
  } else {
    await db.insert(agentSettings).values({ agentName, systemPrompt })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentName } = await req.json()
  if (!(agentName in DEFAULT_PROMPTS)) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 400 })
  }
  await db.delete(agentSettings).where(eq(agentSettings.agentName, agentName))
  return NextResponse.json({ success: true })
}
