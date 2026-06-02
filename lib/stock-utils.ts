export function isDomestic(ticker: string): boolean {
  return ticker.endsWith('.KS') || ticker.endsWith('.KQ') || /^\d{6}$/.test(ticker)
}

export function toNaverCode(ticker: string): string {
  return ticker.replace(/\.(KS|KQ)$/, '')
}

export function getExchangeLabel(ticker: string): string {
  if (ticker.endsWith('.KS')) return '코스피'
  if (ticker.endsWith('.KQ')) return '코스닥'
  if (/^\d{6}$/.test(ticker)) return '국내'
  if (ticker.includes('.')) return ticker.split('.').pop() ?? '해외'
  return '해외'
}

export function getGainColor(val: number): string {
  return val > 0 ? 'text-red-600' : val < 0 ? 'text-blue-600' : 'text-gray-700'
}
