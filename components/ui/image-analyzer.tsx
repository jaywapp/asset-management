'use client'
import { useRef, useState } from 'react'
import { Button } from './button'
import { Camera, Loader2, X } from 'lucide-react'

interface AnalyzeResult {
  entries: Record<string, unknown>[]
}

interface Props {
  context: 'budget' | 'portfolio'
  onResult: (entries: Record<string, unknown>[]) => void
  label?: string
}

export function ImageAnalyzer({ context, onResult, label = '이미지로 입력' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다')
      return
    }

    setError('')
    setLoading(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)

      // base64만 추출 (data:image/jpeg;base64, 제거)
      const base64 = dataUrl.split(',')[1]
      const mediaType = file.type

      try {
        const res = await fetch('/api/ai/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType, context }),
        })
        const data: AnalyzeResult = await res.json()
        if (!res.ok) {
          setError(data.entries ? '' : '분석 실패. 다시 시도해주세요.')
        } else {
          onResult(data.entries ?? [])
        }
      } catch {
        setError('분석 중 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*"
        className="hidden" onChange={handleChange} />

      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
        >
          <Camera size={24} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">클릭하거나 이미지를 드래그하세요</p>
          <p className="text-xs text-gray-400">영수증, 거래내역, 주식화면 등 (최대 5MB)</p>
        </div>
      ) : (
        <div className="relative">
          <img src={preview} alt="분석 중" className="w-full max-h-48 object-contain rounded-lg border" />
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-medium">AI 분석 중...</span>
              </div>
            </div>
          )}
          {!loading && (
            <button
              onClick={() => { setPreview(null); setError('') }}
              className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
