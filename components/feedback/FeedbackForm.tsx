'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FEEDBACK_LIMITS,
  type FeedbackIssue,
} from '@/lib/feedback'

interface FeedbackFormProps {
  appVersion: string
}

export function FeedbackForm({ appVersion }: FeedbackFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [issue, setIssue] = useState<FeedbackIssue | null>(null)

  async function submitFeedback(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')
    setIssue(null)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, contact }),
      })
      const result = (await response.json()) as {
        error?: string
        number?: number
        url?: string
      }

      if (!response.ok || typeof result.number !== 'number' || !result.url) {
        throw new Error(result.error ?? '제보를 등록하지 못했습니다.')
      }

      setIssue({ number: result.number, url: result.url })
      setTitle('')
      setDescription('')
      setContact('')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : '제보를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submitFeedback} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="feedback-title">제목</Label>
        <Input
          id="feedback-title"
          value={title}
          onChange={event => setTitle(event.target.value)}
          maxLength={FEEDBACK_LIMITS.title}
          placeholder="어떤 문제나 의견인지 요약해 주세요"
          required
          disabled={submitting}
        />
        <p className="text-xs text-gray-400 text-right">
          {title.length}/{FEEDBACK_LIMITS.title}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-description">내용</Label>
        <textarea
          id="feedback-description"
          value={description}
          onChange={event => setDescription(event.target.value)}
          maxLength={FEEDBACK_LIMITS.description}
          rows={8}
          placeholder="발생한 상황, 기대한 동작, 개선 의견을 적어 주세요"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          required
          disabled={submitting}
        />
        <p className="text-xs text-gray-400 text-right">
          {description.length}/{FEEDBACK_LIMITS.description}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-contact">연락처 (선택)</Label>
        <Input
          id="feedback-contact"
          value={contact}
          onChange={event => setContact(event.target.value)}
          maxLength={FEEDBACK_LIMITS.contact}
          placeholder="답변을 받을 이메일 또는 연락 방법"
          disabled={submitting}
        />
      </div>

      <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500">
        <p className="font-medium text-gray-700">함께 전송되는 정보</p>
        <ul className="mt-1 list-disc pl-4 space-y-0.5">
          <li>플랫폼: web</li>
          <li>앱 버전: {appVersion}</li>
        </ul>
        <p className="mt-2">
          자산 정보, 계정 정보, 브라우저 정보, 로그는 전송하지 않습니다.
        </p>
      </div>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error} 입력 내용은 그대로 유지됩니다.
          </p>
        )}
        {issue && (
          <p className="text-sm text-green-700">
            제보가 등록되었습니다.{' '}
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              Issue #{issue.number} 확인
            </a>
          </p>
        )}
      </div>

      <Button type="submit" disabled={submitting}>
        <Send size={16} aria-hidden="true" />
        {submitting ? '전송 중...' : '제보 보내기'}
      </Button>
    </form>
  )
}
