import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFeedbackIssueBody,
  createFeedbackIssue,
  FEEDBACK_LABEL,
  FEEDBACK_REPOSITORY,
  FeedbackValidationError,
  validateFeedbackInput,
} from './feedback'
import {
  consumeFeedbackRateLimit,
  resetFeedbackRateLimitForTests,
} from './feedback-rate-limit'

test('validates and normalizes feedback input', () => {
  const feedback = validateFeedbackInput({
    title: '  화면 오류\n확인  ',
    description: '첫 줄\r\n<script>둘째 줄</script>',
    contact: ' user@example.com ',
  })

  assert.deepEqual(feedback, {
    title: '화면 오류 확인',
    description: '첫 줄\n둘째 줄',
    contact: 'user@example.com',
  })
})

test('rejects missing and oversized fields', () => {
  assert.throws(
    () => validateFeedbackInput({ title: '', description: '내용' }),
    FeedbackValidationError,
  )
  assert.throws(
    () =>
      validateFeedbackInput({
        title: '제목',
        description: '가'.repeat(5001),
      }),
    /5000자 이하/,
  )
})

test('builds a body with only allowed diagnostics', () => {
  const body = buildFeedbackIssueBody(
    {
      title: '제목',
      description: '내용',
      contact: 'user@example.com',
    },
    '0.1.0',
  )

  assert.match(body, /플랫폼: web/)
  assert.match(body, /앱 버전: 0\.1\.0/)
  assert.match(body, /연락처\(선택\): user@example\.com/)
  assert.doesNotMatch(body, /user-agent|기기 식별자|자산/)
})

test('creates an issue in the fixed repository with the fixed label', async () => {
  let requestedUrl = ''
  let requestedInit: RequestInit | undefined
  const githubFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    requestedUrl = String(input)
    requestedInit = init
    return Response.json(
      { number: 42, html_url: 'https://github.com/example/issues/42' },
      { status: 201 },
    )
  }

  const issue = await createFeedbackIssue(
    { title: '오류', description: '상세 내용' },
    '0.1.0',
    'test-token',
    githubFetch,
  )

  assert.equal(
    requestedUrl,
    `https://api.github.com/repos/${FEEDBACK_REPOSITORY}/issues`,
  )
  const requestBody = JSON.parse(String(requestedInit?.body))
  assert.equal(requestBody.title, `[${FEEDBACK_LABEL}] 오류`)
  assert.deepEqual(requestBody.labels, [FEEDBACK_LABEL])
  assert.equal(issue.number, 42)
})

test('converts GitHub errors to a stable server error', async () => {
  await assert.rejects(
    createFeedbackIssue(
      { title: '오류', description: '상세 내용' },
      '0.1.0',
      'test-token',
      async () => Response.json({ message: 'private detail' }, { status: 403 }),
    ),
    /GitHub Issue creation failed/,
  )
})

test('limits each authenticated session to three attempts per window', () => {
  resetFeedbackRateLimitForTests()
  const now = 1_000_000

  assert.equal(consumeFeedbackRateLimit('session', now).allowed, true)
  assert.equal(consumeFeedbackRateLimit('session', now + 1).allowed, true)
  assert.equal(consumeFeedbackRateLimit('session', now + 2).allowed, true)
  const limited = consumeFeedbackRateLimit('session', now + 3)

  assert.equal(limited.allowed, false)
  assert.ok(limited.retryAfterSeconds > 0)
  assert.equal(
    consumeFeedbackRateLimit('other-session', now + 3).allowed,
    true,
  )
})
