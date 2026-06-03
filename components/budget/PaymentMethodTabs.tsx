'use client'
import type { InferSelectModel } from 'drizzle-orm'
import type { paymentMethods } from '@/lib/db/schema'

type PaymentMethod = InferSelectModel<typeof paymentMethods>

interface Props {
  methods: PaymentMethod[]
  selected: string | null  // null = 전체, 'transfer' = 이체 탭
  onChange: (id: string | null) => void
}

export function PaymentMethodTabs({ methods, selected, onChange }: Props) {
  return (
    <div className="flex gap-2 flex-wrap pb-3 border-b">
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          selected === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        전체
      </button>
      {methods.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selected === m.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={selected === m.id ? { backgroundColor: m.color ?? '#3b82f6' } : {}}
        >
          {m.name}
        </button>
      ))}
      <button
        onClick={() => onChange('transfer')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          selected === 'transfer' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        이체
      </button>
    </div>
  )
}
