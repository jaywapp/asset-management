'use client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKRW } from '@/lib/utils'
import { isDomestic, getExchangeLabel } from '@/lib/stock-utils'

interface Holding {
  id: string
  ticker: string
  name: string
  quantity: string
  avgPrice: string
  currentPrice: string
}

const fmt = (n: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (!holdings.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">보유 종목이 없습니다. 설정에서 추가하세요.</p>
  }

  const totalValue = holdings.reduce((s, h) => s + Number(h.quantity) * Number(h.currentPrice), 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>종목</TableHead>
          <TableHead className="text-right">수량</TableHead>
          <TableHead className="text-right">평균단가</TableHead>
          <TableHead className="text-right">현재가</TableHead>
          <TableHead className="text-right">평가금액</TableHead>
          <TableHead className="text-right">수익률</TableHead>
          <TableHead className="text-right">비중</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map(h => {
          const qty = Number(h.quantity)
          const avg = Number(h.avgPrice)
          const cur = Number(h.currentPrice)
          const value = qty * cur
          const cost = qty * avg
          const pct = cost > 0 ? ((value - cost) / cost) * 100 : 0
          const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
          const exchange = getExchangeLabel(h.ticker)
          const isKorean = isDomestic(h.ticker)
          return (
            <TableRow key={h.id}>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-900">{h.ticker}</span>
                  <span className={`text-xs px-1 py-0.5 rounded ${isKorean ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {exchange}
                  </span>
                </div>
                <div className="text-xs text-gray-400">{h.name}</div>
              </TableCell>
              <TableCell className="text-right text-sm">{qty.toLocaleString()}</TableCell>
              <TableCell className="text-right text-sm">{fmt(avg)}</TableCell>
              <TableCell className="text-right text-sm">{fmt(cur)}</TableCell>
              <TableCell className="text-right font-medium">{fmt(value)}</TableCell>
              <TableCell className="text-right">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  pct > 0 ? 'bg-red-50 text-red-600' : pct < 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right text-xs text-gray-500">{weight.toFixed(1)}%</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
