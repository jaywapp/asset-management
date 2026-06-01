'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_PROMPTS = [
  '이번달 재정 상황 요약해줘',
  '포트폴리오 리밸런싱 필요한지 봐줘',
  '지난달 대비 순자산 변화는?',
]

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '안녕하세요! 가족 자산관리 CFO입니다. 자산에 대해 궁금한 것이 있으면 무엇이든 물어보세요.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(msg?: string) {
    const text = msg ?? input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content ?? '응답을 처리할 수 없습니다.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '연결 오류가 발생했습니다.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg overflow-hidden bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              msg.role === 'assistant' ? 'bg-blue-100' : 'bg-gray-100')}>
              {msg.role === 'assistant'
                ? <Bot size={16} className="text-blue-600" />
                : <User size={16} className="text-gray-600" />}
            </div>
            <div className={cn('max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
              msg.role === 'assistant' ? 'bg-blue-50 text-gray-800' : 'bg-gray-100 text-gray-800')}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot size={16} className="text-blue-600" />
            </div>
            <div className="bg-blue-50 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-blue-400" />
              <span className="text-xs text-blue-400">분석 중...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-gray-50 px-3 pt-2 pb-1">
        <div className="flex gap-1 mb-2 flex-wrap">
          {QUICK_PROMPTS.map(p => (
            <button key={p} onClick={() => sendMessage(p)} disabled={loading}
              className="text-xs px-2 py-1 rounded-full border bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-600 transition-colors disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pb-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="CFO에게 질문하세요..."
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
            className="bg-white"
          />
          <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} size="icon">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
