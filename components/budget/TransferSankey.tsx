'use client'

interface Flow {
  fromName: string
  toName: string
  amount: number
  transferType: 'internal' | 'external' | null
}

interface Props {
  hubName: string
  flows: Flow[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export function TransferSankey({ hubName, flows }: Props) {
  if (flows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">이체 내역이 없습니다.</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-2">허브: {hubName}</p>
      {flows.map((f, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="text-blue-600 font-medium">{f.fromName}</span>
          <span className="text-gray-400">→</span>
          <span className={f.transferType === 'external' ? 'text-red-600' : 'text-green-700'}>{f.toName}</span>
          <span className="ml-auto font-medium">{fmt(f.amount)}</span>
        </div>
      ))}
    </div>
  )
}
