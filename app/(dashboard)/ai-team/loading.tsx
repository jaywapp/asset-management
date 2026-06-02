import { Skeleton } from '@/components/ui/skeleton'
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <Skeleton className="h-7 w-40" />
      <div className="rounded-xl border bg-white h-[600px] p-4 space-y-4">
        <div className="flex gap-2">
          {[1,2].map(i => <Skeleton key={i} className="h-8 w-24 rounded-md" />)}
        </div>
        <div className="space-y-4 pt-2">
          {[1,2,3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <Skeleton className="h-16 flex-1 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
