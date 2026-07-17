'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface BankFinancials {
  balance: string
  currency: string
  exchangeRateToKrw: string
  includeInNetWorth: boolean
}

interface BankBalanceEditorProps extends BankFinancials {
  paymentMethodId: string
  onSaved: (values: BankFinancials) => void
}

export function BankBalanceEditor({
  paymentMethodId,
  balance: initialBalance,
  currency: initialCurrency,
  exchangeRateToKrw: initialExchangeRate,
  includeInNetWorth: initialInclude,
  onSaved,
}: BankBalanceEditorProps) {
  const [balance, setBalance] = useState(initialBalance)
  const [currency, setCurrency] = useState(initialCurrency)
  const [exchangeRateToKrw, setExchangeRateToKrw] = useState(initialExchangeRate)
  const [includeInNetWorth, setIncludeInNetWorth] = useState(initialInclude)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    setSaving(true)
    setMessage('')
    const response = await fetch(`/api/payment-methods/${paymentMethodId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance, currency, exchangeRateToKrw, includeInNetWorth }),
    })
    setSaving(false)
    if (!response.ok) {
      setMessage('잔액을 저장하지 못했습니다.')
      return
    }
    const saved = await response.json() as BankFinancials
    onSaved(saved)
    setMessage('저장했습니다.')
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-gray-50 p-2 sm:grid-cols-4">
      <label className="text-xs text-gray-500">
        현재 잔액
        <Input className="mt-1 h-8 bg-white" type="number" min="0" step="0.01" value={balance}
          onChange={(event) => setBalance(event.target.value)} />
      </label>
      <label className="text-xs text-gray-500">
        통화
        <Input className="mt-1 h-8 bg-white uppercase" maxLength={3} value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
      </label>
      <label className="text-xs text-gray-500">
        원화 환율
        <Input className="mt-1 h-8 bg-white" type="number" min="0.000001" step="0.000001" value={exchangeRateToKrw}
          onChange={(event) => setExchangeRateToKrw(event.target.value)} />
      </label>
      <div className="flex flex-col justify-end gap-1">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={includeInNetWorth}
            onChange={(event) => setIncludeInNetWorth(event.target.checked)} />
          순자산 포함
        </label>
        <Button type="button" size="sm" className="h-8" disabled={saving} onClick={save}>
          {saving ? '저장 중…' : '잔액 저장'}
        </Button>
      </div>
      {message && <p className="col-span-full text-xs text-gray-500" role="status">{message}</p>}
    </div>
  )
}
