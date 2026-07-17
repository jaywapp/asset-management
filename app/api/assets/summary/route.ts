import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getFamilyAssetSummary } from '@/lib/finance/summary'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(await getFamilyAssetSummary(session.user.id))
}
