import { parseSamsung } from './samsung'
import { parseHyundai } from './hyundai'
import { parseShinhan } from './shinhan'
import { parseWoori } from './woori'
import { parseKakao } from './kakao'
import { parseHana } from './hana'
import { parseToss } from './toss'
import type { CsvParser, ParsedEntry } from './types'

const PARSERS: Array<{ name: string; detect: (fn: string, header: string) => boolean; parse: CsvParser }> = [
  {
    name: 'samsung',
    detect: (fn, h) => /samsung|삼성카드/i.test(fn) || h.includes('이용가맹점명'),
    parse: parseSamsung,
  },
  {
    name: 'hyundai',
    detect: (fn, h) => /hyundai|현대카드/i.test(fn) || (h.includes('이용가맹점') && h.includes('청구금액')),
    parse: parseHyundai,
  },
  {
    name: 'shinhan',
    detect: (fn, h) => /shinhan|신한카드/i.test(fn) || (h.includes('가맹점명') && h.includes('할부개월')),
    parse: parseShinhan,
  },
  {
    name: 'woori',
    detect: (fn, h) => /woori|우리은행/i.test(fn) || (h.includes('적요') && h.includes('출금금액')),
    parse: parseWoori,
  },
  {
    name: 'kakao',
    detect: (fn, h) => /kakao|카카오/i.test(fn) || (h.includes('거래내용') && h.includes('출금금액') && h.includes('입금금액')),
    parse: parseKakao,
  },
  {
    name: 'hana',
    detect: (fn, h) => /hana|하나은행/i.test(fn) || (h.includes('거래구분') && h.includes('거래내용')),
    parse: parseHana,
  },
  {
    name: 'toss',
    detect: (fn, h) => /toss|토스/i.test(fn) || (h.includes('구분') && h.includes('내용') && h.includes('잔액')),
    parse: parseToss,
  },
]

export function detectAndParse(filename: string, csvText: string): { institution: string; entries: ParsedEntry[] } | null {
  const header = csvText.split('\n')[0] ?? ''
  const parser = PARSERS.find(p => p.detect(filename.toLowerCase(), header))
  if (!parser) return null
  return { institution: parser.name, entries: parser.parse(csvText) }
}

export function parseKrDate(raw: string): string {
  // "2026.06.03" | "2026-06-03" | "20260603" → "2026-06-03"
  const trimmed = raw.trim()
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
  }
  return trimmed.replace(/\./g, '-').slice(0, 10)
}

export function parseKrAmount(raw: string): number {
  return Math.abs(parseInt(raw.replace(/[,\s원]/g, ''), 10) || 0)
}
