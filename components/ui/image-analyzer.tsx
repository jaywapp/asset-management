'use client'
import { useRef, useState } from 'react'
import { Camera, Loader2, X, CheckCircle } from 'lucide-react'

interface AnalyzeResult {
  entries: Record<string, unknown>[]
}

interface Props {
  context: 'budget' | 'portfolio'
  onResult: (entries: Record<string, unknown>[]) => void
  label?: string
}

interface FileStatus {
  name: string
  preview: string
  status: 'pending' | 'analyzing' | 'done' | 'error'
  count?: number
}

export function ImageAnalyzer({ context, onResult, label = '이미지로 입력' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function analyzeFile(file: File): Promise<Record<string, unknown>[]> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const base64 = dataUrl.split(',')[1]
        try {
          const res = await fetch('/api/ai/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, mediaType: file.type, context }),
          })
          const data: AnalyzeResult = await res.json()
          resolve(res.ok ? (data.entries ?? []) : [])
        } catch {
          resolve([])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleFiles(selectedFiles: FileList) {
    const validFiles = Array.from(selectedFiles).filter(f => {
      if (!f.type.startsWith('image/')) return false
      if (f.size > 5 * 1024 * 1024) return false
      return true
    })

    if (!validFiles.length) {
      setError('이미지 파일만 업로드 가능합니다 (최대 5MB)')
      return
    }

    setError('')
    setLoading(true)

    const previews: FileStatus[] = validFiles.map(f => ({
      name: f.name,
      preview: URL.createObjectURL(f),
      status: 'pending',
    }))
    setFiles(previews)

    const allEntries: Record<string, unknown>[] = []

    for (let i = 0; i < validFiles.length; i++) {
      setFiles(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: 'analyzing' } : p
      ))

      const entries = await analyzeFile(validFiles[i])
      allEntries.push(...entries)

      setFiles(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: entries.length > 0 ? 'done' : 'error', count: entries.length } : p
      ))
    }

    setLoading(false)
    if (allEntries.length > 0) {
      onResult(allEntries)
    } else {
      setError('이미지에서 데이터를 추출할 수 없습니다.')
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  function reset() {
    files.forEach(f => URL.revokeObjectURL(f.preview))
    setFiles([])
    setError('')
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*" multiple
        className="hidden" onChange={handleChange} />

      {files.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
        >
          <Camera size={24} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-xs text-gray-400 mt-1">클릭하거나 이미지를 드래그하세요 · 여러 장 동시 선택 가능</p>
          <p className="text-xs text-gray-400">영수증, 거래내역, 주식화면 등 (장당 최대 5MB)</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-gray-50">
                <img src={f.preview} alt={f.name} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 flex items-center justify-center ${
                  f.status === 'analyzing' ? 'bg-white/70' :
                  f.status === 'done' ? 'bg-green-500/20' :
                  f.status === 'error' ? 'bg-red-500/20' : ''
                }`}>
                  {f.status === 'analyzing' && (
                    <Loader2 size={20} className="animate-spin text-blue-500" />
                  )}
                  {f.status === 'done' && (
                    <div className="text-center">
                      <CheckCircle size={20} className="text-green-600 mx-auto" />
                      <span className="text-xs text-green-700 font-medium">{f.count}건</span>
                    </div>
                  )}
                  {f.status === 'error' && (
                    <span className="text-xs text-red-500 bg-white/80 px-1 rounded">실패</span>
                  )}
                </div>
              </div>
            ))}

            {/* 추가 업로드 버튼 */}
            {!loading && (
              <div
                onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <span className="text-2xl text-gray-300">+</span>
              </div>
            )}
          </div>

          {!loading && (
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X size={12} />초기화
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
