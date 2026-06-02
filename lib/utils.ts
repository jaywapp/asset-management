import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatKRW = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export const CACHE_SHORT = { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' }
export const CACHE_LONG  = { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }
