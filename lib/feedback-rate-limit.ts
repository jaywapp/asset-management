const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 3

const attemptsBySession = new Map<string, number[]>()

export interface FeedbackRateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export function consumeFeedbackRateLimit(
  sessionId: string,
  now = Date.now(),
): FeedbackRateLimitResult {
  const cutoff = now - WINDOW_MS
  const attempts = (attemptsBySession.get(sessionId) ?? []).filter(
    timestamp => timestamp > cutoff,
  )

  if (attempts.length >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((attempts[0] + WINDOW_MS - now) / 1000),
    )
    attemptsBySession.set(sessionId, attempts)
    return { allowed: false, retryAfterSeconds }
  }

  attempts.push(now)
  attemptsBySession.set(sessionId, attempts)
  return { allowed: true, retryAfterSeconds: 0 }
}

export function resetFeedbackRateLimitForTests() {
  attemptsBySession.clear()
}
