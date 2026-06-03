import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { detectAndParse } from '@/lib/csv-parsers'
import { classifyEntries } from '@/lib/csv-parsers/classifier'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { csvText, filename, paymentMethodId } = body as {
    csvText?: string
    filename?: string
    paymentMethodId: string
  }

  if (!csvText || !filename) {
    return NextResponse.json({ error: 'csvText and filename required' }, { status: 400 })
  }

  const parsed = detectAndParse(filename, csvText)
  if (!parsed) {
    return NextResponse.json(
      { error: '지원하지 않는 파일 형식입니다. 기관을 수동으로 선택해주세요.', needsManualSelect: true },
      { status: 422 }
    )
  }

  const { confirmed, uncertain } = await classifyEntries(parsed.entries, paymentMethodId)
  return NextResponse.json({ confirmed, uncertain, institution: parsed.institution })
}
