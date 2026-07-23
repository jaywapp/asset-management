import { NextResponse } from 'next/server'
import packageJson from '@/package.json'
import { auth } from '@/lib/auth'
import {
  createFeedbackIssue,
  FeedbackValidationError,
  validateFeedbackInput,
} from '@/lib/feedback'
import { consumeFeedbackRateLimit } from '@/lib/feedback-rate-limit'

const MAX_REQUEST_BYTES = 12_000

function hasAllowedOrigin(req: Request) {
  const origin = req.headers.get('origin')
  return !origin || origin === new URL(req.url).origin
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: '제보 내용이 너무 깁니다.' }, { status: 413 })
  }

  const rateLimit = consumeFeedbackRateLimit(session.user.id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '제보 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    )
  }

  try {
    const rawBody = await req.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: '제보 내용이 너무 깁니다.' }, { status: 413 })
    }

    const feedback = validateFeedbackInput(JSON.parse(rawBody))
    const token = process.env.GITHUB_ISSUES_TOKEN
    if (!token) {
      return NextResponse.json(
        { error: '제보 기능이 아직 설정되지 않았습니다.' },
        { status: 503 },
      )
    }

    const issue = await createFeedbackIssue(
      feedback,
      packageJson.version,
      token,
    )
    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    if (error instanceof FeedbackValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: '올바른 제보 내용을 입력해 주세요.' },
        { status: 400 },
      )
    }
    return NextResponse.json(
      {
        error:
          '제보를 등록하지 못했습니다. 입력 내용은 유지되니 잠시 후 다시 시도해 주세요.',
      },
      { status: 502 },
    )
  }
}
