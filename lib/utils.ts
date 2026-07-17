import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatKRW = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

// Authenticated financial data must reflect writes immediately in the same browser session.
export const CACHE_SHORT = { 'Cache-Control': 'private, no-store' }
export const CACHE_LONG  = { 'Cache-Control': 'private, no-store' }
