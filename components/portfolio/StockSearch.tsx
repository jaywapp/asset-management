'use client'
import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Search, Loader2 } from 'lucide-react'

interface StockResult {
  symbol: string
  name: string
  exchange: string
  type: string
}

interface Props {
  onSelect: (stock: StockResult) => void
  placeholder?: string
}

const TYPE_BADGES: Record<string, string> = {
  EQUITY: '주식', ETF: 'ETF', MUTUALFUND: '펀드', INDEX: '지수',
}

export function StockSearch({ onSelect, placeholder = '종목명 또는 티커 검색...' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/portfolio/search-stock?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data)
        setOpen(data.length > 0)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(stock: StockResult) {
    onSelect(stock)
    setQuery(stock.name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-8 pr-8"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map(stock => (
            <button
              key={stock.symbol}
              type="button"
              onClick={() => handleSelect(stock)}
              className="w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center justify-between gap-2 border-b last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{stock.name}</p>
                <p className="text-xs text-gray-400">{stock.symbol}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {stock.exchange && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{stock.exchange}</span>
                )}
                {stock.type && TYPE_BADGES[stock.type] && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                    {TYPE_BADGES[stock.type]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
