export const FEEDBACK_REPOSITORY = 'jaywapp/asset-management'
export const FEEDBACK_LABEL = '제보'

export const FEEDBACK_LIMITS = {
  title: 120,
  description: 5000,
  contact: 200,
} as const

export interface FeedbackInput {
  title: string
  description: string
  contact?: string
}

export interface FeedbackIssue {
  number: number
  url: string
}

export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeedbackValidationError'
  }
}

type GitHubFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

function normalizeMultilineText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style)\b[^>]*>/gi, '')
    .trim()
}

function normalizeSingleLineText(value: string) {
  return normalizeMultilineText(value).replace(/\s+/g, ' ')
}

function requireString(
  body: Record<string, unknown>,
  field: keyof FeedbackInput,
  label: string,
) {
  const value = body[field]
  if (typeof value !== 'string') {
    throw new FeedbackValidationError(`${label}을(를) 입력해 주세요.`)
  }
  return value
}

export function validateFeedbackInput(value: unknown): FeedbackInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FeedbackValidationError('올바른 제보 내용을 입력해 주세요.')
  }

  const body = value as Record<string, unknown>
  const title = normalizeSingleLineText(requireString(body, 'title', '제목'))
  const description = normalizeMultilineText(
    requireString(body, 'description', '내용'),
  )
  const rawContact = body.contact

  if (!title) {
    throw new FeedbackValidationError('제목을 입력해 주세요.')
  }
  if (title.length > FEEDBACK_LIMITS.title) {
    throw new FeedbackValidationError(
      `제목은 ${FEEDBACK_LIMITS.title}자 이하로 입력해 주세요.`,
    )
  }
  if (!description) {
    throw new FeedbackValidationError('내용을 입력해 주세요.')
  }
  if (description.length > FEEDBACK_LIMITS.description) {
    throw new FeedbackValidationError(
      `내용은 ${FEEDBACK_LIMITS.description}자 이하로 입력해 주세요.`,
    )
  }
  if (rawContact !== undefined && typeof rawContact !== 'string') {
    throw new FeedbackValidationError('연락처 형식이 올바르지 않습니다.')
  }

  const contact =
    typeof rawContact === 'string'
      ? normalizeSingleLineText(rawContact)
      : undefined
  if (contact && contact.length > FEEDBACK_LIMITS.contact) {
    throw new FeedbackValidationError(
      `연락처는 ${FEEDBACK_LIMITS.contact}자 이하로 입력해 주세요.`,
    )
  }

  return { title, description, contact: contact || undefined }
}

export function buildFeedbackIssueBody(
  feedback: FeedbackInput,
  appVersion: string,
) {
  const sections = [
    '## 제보 내용',
    feedback.description,
    '',
    '## 전송 정보',
    '- 플랫폼: web',
    `- 앱 버전: ${normalizeSingleLineText(appVersion)}`,
  ]

  if (feedback.contact) {
    sections.push(`- 연락처(선택): ${feedback.contact}`)
  }

  sections.push(
    '',
    '> 이 Issue는 앱의 인증된 사용자 제보 화면에서 생성되었습니다.',
  )
  return sections.join('\n')
}

export async function createFeedbackIssue(
  feedback: FeedbackInput,
  appVersion: string,
  token: string,
  githubFetch: GitHubFetch = fetch,
): Promise<FeedbackIssue> {
  const response = await githubFetch(
    `https://api.github.com/repos/${FEEDBACK_REPOSITORY}/issues`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `[${FEEDBACK_LABEL}] ${feedback.title}`,
        body: buildFeedbackIssueBody(feedback, appVersion),
        labels: [FEEDBACK_LABEL],
      }),
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error('GitHub Issue creation failed')
  }

  const issue = (await response.json()) as {
    number?: unknown
    html_url?: unknown
  }
  if (
    typeof issue.number !== 'number' ||
    typeof issue.html_url !== 'string'
  ) {
    throw new Error('GitHub Issue response was invalid')
  }

  return { number: issue.number, url: issue.html_url }
}
