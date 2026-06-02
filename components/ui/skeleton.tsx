export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-32" />
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-2">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton({ cards = 4, rows = 5 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-5 animate-pulse">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      {/* 요약 카드 */}
      <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(cards, 4)} gap-3`}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-4 space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
      {/* 목록 카드 */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <ListSkeleton rows={rows} />
      </div>
    </div>
  )
}
