# 카드값 결제 + 반복 지출 템플릿 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** §9 결제통장 선입금 체크박스 UX와 §10 변동/고정 반복 지출 템플릿 기능을 구현한다.

**Architecture:** Next.js 16 App Router 풀스택. 스키마에 `recurringTemplates` 테이블 신설 + `expenses`에 `recurringTemplateId` FK 추가. 가계부 폼에 선입금 체크박스·템플릿 선택 드롭다운 추가. 설정 페이지에 반복 지출 탭 추가. 월별 크론에 자동 생성 로직 추가.

**Tech Stack:** Next.js 16.2.6, TypeScript strict, Drizzle ORM, Neon PostgreSQL

---

## 파일 구조

```
lib/db/schema.ts                              ← 수정: recurringAmountTypeEnum + recurringTemplates 테이블 + expenses.recurringTemplateId
app/api/recurring-templates/route.ts          ← 신규: GET, POST
app/api/recurring-templates/[id]/route.ts     ← 신규: PATCH, DELETE
app/api/cron/monthly/route.ts                 ← 수정: 템플릿 자동 생성 로직 추가
components/settings/RecurringTemplatesTab.tsx ← 신규: 반복 지출 CRUD UI
app/(dashboard)/settings/page.tsx            ← 수정: 반복 지출 탭 추가 (grid-cols-8)
app/(dashboard)/budget/page.tsx              ← 수정: 선입금 체크박스 + 변동 미입력 배너 + 템플릿 드롭다운
lib/agents/tools.ts                           ← 수정: get_expense_items recurringTemplateId 필터
```

---

## Task 1: Schema 확장 + DB 마이그레이션

**Files:**
- Modify: `lib/db/schema.ts`

### 배경

이미 구현된 내용:
- `paymentMethods` 테이블 (linkedBankId 포함)
- `expenses` 테이블 (transferType, transferToId, paymentMethodId 포함)
- `expenseCatEnum`, `paymentMethodTypeEnum`, `ownerEnum`, `transferTypeEnum`

추가할 내용:
- `recurringAmountTypeEnum`: `'fixed' | 'variable'`
- `recurringTemplates` 테이블: `paymentMethods` 뒤, `income` 앞에 정의
- `expenses.recurringTemplateId`: `recurringTemplates` 참조 FK

- [ ] **Step 1: schema.ts에 enum + 테이블 추가**

`lib/db/schema.ts` 파일에서 `paymentMethods` 테이블 선언 바로 아래, `income` 테이블 선언 바로 위에 다음을 추가한다:

```typescript
export const recurringAmountTypeEnum = pgEnum('recurring_amount_type', ['fixed', 'variable'])

export const recurringTemplates = pgTable('recurring_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: expenseCatEnum('category').notNull(),
  description: text('description').notNull(),
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
  amountType: recurringAmountTypeEnum('amount_type').notNull(),
  estimatedAmount: decimal('estimated_amount', { precision: 18, scale: 0 }),
  fixedAmount: decimal('fixed_amount', { precision: 18, scale: 0 }),
  dayOfMonth: integer('day_of_month'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

그리고 `expenses` 테이블 내 마지막 컬럼 뒤에 추가:
```typescript
  recurringTemplateId: text('recurring_template_id').references(() => recurringTemplates.id, { onDelete: 'set null' }),
```

최종 `expenses` 테이블 전체:
```typescript
export const expenses = pgTable('expenses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: expenseCatEnum('category').notNull(),
  amount: decimal('amount', { precision: 18, scale: 0 }).notNull(),
  description: text('description'),
  date: timestamp('date').notNull(),
  isFixed: boolean('is_fixed').default(false),
  isRecurring: boolean('is_recurring').default(false),
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
  transferType: transferTypeEnum('transfer_type'),
  transferToId: text('transfer_to_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
  recurringTemplateId: text('recurring_template_id').references(() => recurringTemplates.id, { onDelete: 'set null' }),
})
```

- [ ] **Step 2: TypeScript 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: DB 마이그레이션**

```powershell
$env:DATABASE_URL="postgresql://neondb_owner:npg_NMnaJAtf6g8Z@ep-plain-rain-aqs5sumk.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"
npx drizzle-kit push
```

Expected: `[✓] Changes applied`

- [ ] **Step 4: 커밋**

```bash
git add lib/db/schema.ts
git commit -m "feat: add recurringTemplates table and recurringTemplateId to expenses"
```

---

## Task 2: 반복 지출 템플릿 CRUD API

**Files:**
- Create: `app/api/recurring-templates/route.ts`
- Create: `app/api/recurring-templates/[id]/route.ts`

### 배경

패턴은 `app/api/payment-methods/route.ts` 및 `[id]/route.ts`와 동일하다.
- GET: 로그인 사용자 소유 템플릿 전체 반환
- POST: 신규 생성 (isActive 기본 true)
- PATCH: 부분 수정 — undefined 필드는 updateData에 포함하지 않는다
- DELETE: 소프트 삭제 없이 즉시 삭제, 204 반환

- [ ] **Step 1: GET/POST 라우트 생성**

`app/api/recurring-templates/route.ts` 파일 생성:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { recurringTemplates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select().from(recurringTemplates)
    .where(eq(recurringTemplates.userId, session.user.id))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(recurringTemplates).values({
    userId: session.user.id,
    category: body.category,
    description: body.description,
    paymentMethodId: body.paymentMethodId ?? null,
    amountType: body.amountType,
    estimatedAmount: body.estimatedAmount ?? null,
    fixedAmount: body.fixedAmount ?? null,
    dayOfMonth: body.dayOfMonth ?? null,
    isActive: true,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
```

- [ ] **Step 2: PATCH/DELETE 라우트 생성**

`app/api/recurring-templates/[id]/route.ts` 파일 생성:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { recurringTemplates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  if (body.category !== undefined) updateData.category = body.category
  if (body.description !== undefined) updateData.description = body.description
  if (body.paymentMethodId !== undefined) updateData.paymentMethodId = body.paymentMethodId
  if (body.amountType !== undefined) updateData.amountType = body.amountType
  if (body.estimatedAmount !== undefined) updateData.estimatedAmount = body.estimatedAmount
  if (body.fixedAmount !== undefined) updateData.fixedAmount = body.fixedAmount
  if (body.dayOfMonth !== undefined) updateData.dayOfMonth = body.dayOfMonth
  if (body.isActive !== undefined) updateData.isActive = body.isActive

  const [row] = await db.update(recurringTemplates)
    .set(updateData)
    .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, session.user.id)))
    .returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.delete(recurringTemplates)
    .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, session.user.id)))
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: TypeScript 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add app/api/recurring-templates/route.ts app/api/recurring-templates/[id]/route.ts
git commit -m "feat: add recurring templates CRUD API"
```

---

## Task 3: 크론 monthly — 템플릿 자동 생성

**Files:**
- Modify: `app/api/cron/monthly/route.ts`

### 배경

현재 cron/monthly는 `runBudgetAgent`만 실행한다.
매달 1일, 모든 활성 템플릿에 대해:
- `amountType = 'fixed'`: `fixedAmount`로 expenses 자동 생성
- `amountType = 'variable'`: `amount = '0'`으로 expenses 생성 (미입력 상태 표시)

이미 이번 달에 해당 템플릿 ID로 생성된 항목이 있으면 건너뛴다 (멱등성 보장).

- [ ] **Step 1: route.ts 업데이트**

`app/api/cron/monthly/route.ts` 전체를 다음으로 교체:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, expenses, recurringTemplates } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { runBudgetAgent } from '@/lib/agents/budget-agent'
import { createId } from '@paralleldrive/cuid2'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const allUsers = await db.select({ id: users.id }).from(users)
  const processed = new Set<string>()

  for (const user of allUsers) {
    if (processed.has(user.id)) continue
    processed.add(user.id)

    // 활성 반복 템플릿 자동 생성
    const templates = await db.select().from(recurringTemplates)
      .where(and(eq(recurringTemplates.userId, user.id), eq(recurringTemplates.isActive, true)))

    for (const tmpl of templates) {
      const existing = await db.select({ id: expenses.id }).from(expenses)
        .where(and(
          eq(expenses.userId, user.id),
          eq(expenses.recurringTemplateId, tmpl.id),
          gte(expenses.date, monthStart),
          lte(expenses.date, monthEnd),
        ))
      if (existing.length > 0) continue

      const day = Math.min(tmpl.dayOfMonth ?? 1, monthEnd.getDate())
      const targetDate = new Date(year, month - 1, day)

      await db.insert(expenses).values({
        id: createId(),
        userId: user.id,
        category: tmpl.category,
        amount: tmpl.amountType === 'fixed' ? (tmpl.fixedAmount ?? '0') : '0',
        description: tmpl.description,
        date: targetDate,
        isFixed: true,
        isRecurring: true,
        paymentMethodId: tmpl.paymentMethodId,
        recurringTemplateId: tmpl.id,
      })
    }

    await runBudgetAgent(user.id)
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: TypeScript 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add app/api/cron/monthly/route.ts
git commit -m "feat: auto-generate expenses from recurring templates in monthly cron"
```

---

## Task 4: 설정 페이지 — 반복 지출 탭

**Files:**
- Create: `components/settings/RecurringTemplatesTab.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

### 배경

설정 페이지는 현재 7개 탭 (`grid-cols-7`). 8번째 탭 "반복 지출"을 추가한다 (`grid-cols-8`).
`RecurringTemplatesTab`은 `components/settings/PaymentMethodsTab.tsx`와 같은 패턴으로 작성한다.

UI:
- 활성/비활성 토글 (isActive 뱃지)
- 설명·카테고리·결제수단·금액유형·금액·결제일 표시
- 추가 폼: description, category, amountType, fixedAmount OR estimatedAmount, paymentMethodId, dayOfMonth
- 삭제 버튼

`paymentMethods`를 props로 받아 결제수단 이름을 표시한다.

카테고리 한글 레이블:
```
food: '식비', transport: '교통', housing: '주거', medical: '의료',
education: '교육', leisure: '여가', subscription: '구독', other: '기타'
```

- [ ] **Step 1: RecurringTemplatesTab 컴포넌트 생성**

`components/settings/RecurringTemplatesTab.tsx` 파일 생성:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Plus, Trash2 } from 'lucide-react'

const CAT_LABELS: Record<string, string> = {
  food: '식비', transport: '교통', housing: '주거', medical: '의료',
  education: '교육', leisure: '여가', subscription: '구독', other: '기타',
}
const EXPENSE_CATS = ['food', 'transport', 'housing', 'medical', 'education', 'leisure', 'subscription', 'other']

interface Template {
  id: string
  category: string
  description: string
  paymentMethodId: string | null
  amountType: 'fixed' | 'variable'
  estimatedAmount: string | null
  fixedAmount: string | null
  dayOfMonth: number | null
  isActive: boolean
}

interface Props {
  paymentMethods: { id: string; name: string }[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export function RecurringTemplatesTab({ paymentMethods }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [form, setForm] = useState({
    description: '',
    category: 'subscription',
    amountType: 'fixed' as 'fixed' | 'variable',
    fixedAmount: '',
    estimatedAmount: '',
    paymentMethodId: '',
    dayOfMonth: '',
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/recurring-templates')
    if (res.ok) setTemplates(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/recurring-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: form.description,
        category: form.category,
        amountType: form.amountType,
        fixedAmount: form.amountType === 'fixed' && form.fixedAmount ? form.fixedAmount : null,
        estimatedAmount: form.amountType === 'variable' && form.estimatedAmount ? form.estimatedAmount : null,
        paymentMethodId: form.paymentMethodId || null,
        dayOfMonth: form.dayOfMonth ? parseInt(form.dayOfMonth) : null,
      }),
    })
    setForm({ description: '', category: 'subscription', amountType: 'fixed', fixedAmount: '', estimatedAmount: '', paymentMethodId: '', dayOfMonth: '' })
    await load()
    setSaving(false)
  }

  async function toggleActive(tmpl: Template) {
    await fetch(`/api/recurring-templates/${tmpl.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !tmpl.isActive }),
    })
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('이 반복 지출 템플릿을 삭제할까요?')) return
    await fetch(`/api/recurring-templates/${id}`, { method: 'DELETE' })
    await load()
  }

  const methodName = (id: string | null) =>
    id ? (paymentMethods.find(m => m.id === id)?.name ?? id) : '-'

  return (
    <div className="space-y-4">
      {/* 템플릿 목록 */}
      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw size={14} className="text-orange-500" />
              반복 지출 목록 ({templates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{tmpl.description}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {CAT_LABELS[tmpl.category] ?? tmpl.category}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      tmpl.amountType === 'fixed'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {tmpl.amountType === 'fixed' ? '고정' : '변동'}
                    </span>
                    {!tmpl.isActive && (
                      <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">비활성</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                    {tmpl.amountType === 'fixed' && tmpl.fixedAmount && (
                      <span>{fmt(Number(tmpl.fixedAmount))}</span>
                    )}
                    {tmpl.amountType === 'variable' && tmpl.estimatedAmount && (
                      <span>예상 {fmt(Number(tmpl.estimatedAmount))}</span>
                    )}
                    {tmpl.paymentMethodId && <span>{methodName(tmpl.paymentMethodId)}</span>}
                    {tmpl.dayOfMonth && <span>매월 {tmpl.dayOfMonth}일</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(tmpl)}
                    className={`text-xs h-7 px-2 ${tmpl.isActive ? 'text-gray-400' : 'text-orange-500'}`}>
                    {tmpl.isActive ? '비활성화' : '활성화'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(tmpl.id)}
                    className="text-xs h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 추가 폼 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus size={14} />반복 지출 추가
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <Label>항목명</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="예: 넷플릭스, 관리비" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>카테고리</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATS.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>금액 유형</Label>
                <Select value={form.amountType} onValueChange={v => setForm(p => ({ ...p, amountType: v as 'fixed' | 'variable' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">고정 (매달 동일)</SelectItem>
                    <SelectItem value="variable">변동 (매달 다름)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.amountType === 'fixed' ? (
                <div>
                  <Label>고정 금액 (원)</Label>
                  <Input type="number" value={form.fixedAmount}
                    onChange={e => setForm(p => ({ ...p, fixedAmount: e.target.value }))}
                    placeholder="17900" required />
                </div>
              ) : (
                <div>
                  <Label>예상 금액 (원, 참고용)</Label>
                  <Input type="number" value={form.estimatedAmount}
                    onChange={e => setForm(p => ({ ...p, estimatedAmount: e.target.value }))}
                    placeholder="150000" />
                </div>
              )}
              <div>
                <Label>결제일 (선택)</Label>
                <Input type="number" min="1" max="31" value={form.dayOfMonth}
                  onChange={e => setForm(p => ({ ...p, dayOfMonth: e.target.value }))}
                  placeholder="25" />
              </div>
            </div>
            <div>
              <Label>결제수단 (선택)</Label>
              <Select value={form.paymentMethodId} onValueChange={v => setForm(p => ({ ...p, paymentMethodId: v }))}>
                <SelectTrigger><SelectValue placeholder="결제수단 선택 (선택사항)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">없음</SelectItem>
                  {paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? '추가 중...' : '반복 지출 추가'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: settings/page.tsx에 탭 추가**

`app/(dashboard)/settings/page.tsx`에서 다음 두 가지를 수정한다.

**import 추가** (기존 import 블록 끝에):
```typescript
import { RecurringTemplatesTab } from '@/components/settings/RecurringTemplatesTab'
```

**TabsList** 변경 (`grid-cols-7` → `grid-cols-8`):
```typescript
<TabsList className="grid w-full grid-cols-8">
```

**TabsTrigger 추가** (기존 `<TabsTrigger value="import">` 바로 뒤):
```typescript
<TabsTrigger value="recurring">반복 지출</TabsTrigger>
```

**TabsContent 추가** (기존 `</TabsContent>` — import 탭 닫기 태그 바로 뒤):
```typescript
<TabsContent value="recurring" className="mt-4">
  <RecurringTemplatesTab paymentMethods={paymentMethodsList} />
</TabsContent>
```

- [ ] **Step 3: TypeScript 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add components/settings/RecurringTemplatesTab.tsx app/(dashboard)/settings/page.tsx
git commit -m "feat: add recurring templates tab to settings page"
```

---

## Task 5: 가계부 페이지 업데이트

**Files:**
- Modify: `app/(dashboard)/budget/page.tsx`

### 배경

세 가지 변경을 한 번에 처리한다:

**A. §9 선입금 체크박스**
- 지출 입력 시 결제수단이 카드(`credit_card` | `debit_card`)이고 `linkedBankId`가 있을 때 체크박스 표시
- 체크 후 제출하면: 원래 지출 + 동일 금액의 internal transfer (hub → 카드 결제 통장) 자동 생성
- 허브 계좌 없으면 체크박스 비표시

**B. §10 변동 미입력 배너**
- `recurringTemplates`(variable, active) + 이번 달 `expenses` 교차 비교
- `recurringTemplateId`가 있고 `amount = '0'`인 항목 = 미입력
- 기존 반복 고정지출 배너 아래에 별도 파란 배너로 표시
- 항목 클릭 시 해당 expense ID로 편집 모드 전환 (금액 입력 유도)

**C. §10 템플릿 드롭다운**
- 지출 폼 상단에 "반복 지출 선택 (선택사항)" 드롭다운 추가
- 선택 시 category, paymentMethodId 자동 채움 (amount는 fixed면 자동, variable면 공란)
- 선택 후 제출하면 `recurringTemplateId`도 body에 포함

### 주의

- `Entry` 인터페이스에 `recurringTemplateId?: string | null`, `paymentMethodId?: string | null` 추가
- `RecurringTemplate` 인터페이스 정의 (현재 있는 것과 다름 — 기존 것은 별도)
- `prefundTransfer` state: boolean
- `selectedTemplateId` state: string ('' = 없음)
- `recurringTemplatesList` state: RecurringTemplate[]
- `pendingVariableTemplates` 계산: computed from `recurringTemplatesList` + `entries`

- [ ] **Step 1: 인터페이스 및 상태 추가**

`app/(dashboard)/budget/page.tsx` 파일에서:

기존 `interface Entry` 를 다음으로 교체:
```typescript
interface Entry {
  id: string
  type: EntryType
  category: string
  amount: string
  description: string | null
  date: string
  isFixed?: boolean
  isRecurring?: boolean
  paymentMethodId?: string | null
  recurringTemplateId?: string | null
}
```

기존 `interface RecurringTemplate` (line 37-43)을 다음으로 교체:
```typescript
interface RecurringTemplate {
  id: string
  category: string
  description: string
  amountType: 'fixed' | 'variable'
  estimatedAmount: string | null
  fixedAmount: string | null
  paymentMethodId: string | null
  isActive: boolean
}
```

state 선언 블록에서 기존 `// 결제수단 탭` 그룹 아래에 다음을 추가:
```typescript
  // 선입금 체크박스
  const [prefundTransfer, setPrefundTransfer] = useState(false)
  // 반복 템플릿 드롭다운
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [recurringTemplatesList, setRecurringTemplatesList] = useState<RecurringTemplate[]>([])
```

- [ ] **Step 2: 템플릿 fetch + pendingVariableTemplates 계산**

기존 `useEffect(() => { fetch('/api/payment-methods')... }, [])` 바로 아래에 추가:
```typescript
  useEffect(() => {
    fetch('/api/recurring-templates').then(r => r.json()).then(setRecurringTemplatesList)
  }, [])
```

기존 `const filteredEntries = ...` 계산 바로 아래에 추가:
```typescript
  const pendingVariableTemplates = recurringTemplatesList.filter(tmpl => {
    if (!tmpl.isActive || tmpl.amountType !== 'variable') return false
    return !entries.some(e =>
      e.type === 'expense' &&
      e.recurringTemplateId === tmpl.id &&
      Number(e.amount) > 0
    )
  })
```

- [ ] **Step 3: handleSubmit에 선입금 로직 추가**

기존 `handleSubmit` 함수를 다음으로 교체:
```typescript
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSaving(true)

    const selectedMethod = paymentMethodsList.find(m => m.id === selectedPaymentMethodId)
    const hub = paymentMethodsList.find(m => m.isHub)

    const endpoint = type === 'income' ? '/api/income' : '/api/expenses'
    const body = type === 'income'
      ? {
          category, amount, description, date,
          paymentMethodId: selectedPaymentMethodId || undefined,
        }
      : {
          category, amount, description, date, isFixed, isRecurring: isFixed && isRecurring,
          paymentMethodId: selectedPaymentMethodId || undefined,
          recurringTemplateId: selectedTemplateId || undefined,
        }

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    // §9 선입금: 카드 + linkedBankId + 허브 + 체크박스 체크됐을 때
    if (
      type === 'expense' &&
      prefundTransfer &&
      selectedMethod &&
      (selectedMethod.type === 'credit_card' || selectedMethod.type === 'debit_card') &&
      selectedMethod.linkedBankId &&
      hub
    ) {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          amount,
          description: `[${selectedMethod.name}] ${description || '선입금'}`,
          date,
          isFixed: false,
          isRecurring: false,
          paymentMethodId: hub.id,
          transferType: 'internal',
          transferToId: selectedMethod.linkedBankId,
        }),
      })
    }

    setAmount('')
    setDescription('')
    setDate(now.toISOString().split('T')[0])
    setPrefundTransfer(false)
    setSelectedTemplateId('')
    await load()
    await checkRecurring()
    setSaving(false)
  }
```

- [ ] **Step 4: 템플릿 드롭다운 + 선입금 체크박스 폼 추가**

기존 폼에서 수입/지출 토글(`<div className="flex gap-2 mb-3">`) 바로 아래, 고정/변동 토글 위에 다음을 삽입:

```typescript
            {/* 반복 지출 템플릿 선택 (지출일 때만) */}
            {type === 'expense' && recurringTemplatesList.filter(t => t.isActive).length > 0 && (
              <div className="mb-3">
                <select
                  value={selectedTemplateId}
                  onChange={e => {
                    const tmplId = e.target.value
                    setSelectedTemplateId(tmplId)
                    if (tmplId) {
                      const tmpl = recurringTemplatesList.find(t => t.id === tmplId)
                      if (tmpl) {
                        setCategory(tmpl.category)
                        if (tmpl.paymentMethodId) setSelectedPaymentMethodId(tmpl.paymentMethodId)
                        if (tmpl.amountType === 'fixed' && tmpl.fixedAmount) setAmount(tmpl.fixedAmount)
                      }
                    } else {
                      setSelectedTemplateId('')
                    }
                  }}
                  className="w-full text-sm border rounded px-2 py-1.5 bg-white text-gray-700"
                >
                  <option value="">반복 지출 선택 (선택사항)</option>
                  {recurringTemplatesList.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.id}>{t.description}</option>
                  ))}
                </select>
              </div>
            )}
```

기존 결제수단 `<select>` 바로 아래, 날짜+추가 버튼 행 위에 선입금 체크박스 삽입:

```typescript
            {/* 선입금 체크박스: 카드 + linkedBankId + 허브 있을 때만 */}
            {(() => {
              const selectedMethod = paymentMethodsList.find(m => m.id === selectedPaymentMethodId)
              const hub = paymentMethodsList.find(m => m.isHub)
              const showPrefund = type === 'expense' &&
                selectedMethod &&
                (selectedMethod.type === 'credit_card' || selectedMethod.type === 'debit_card') &&
                selectedMethod.linkedBankId &&
                hub
              if (!showPrefund) return null
              const bankName = paymentMethodsList.find(m => m.id === selectedMethod.linkedBankId)?.name ?? '결제 통장'
              return (
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer mb-2 pl-1">
                  <input
                    type="checkbox"
                    checked={prefundTransfer}
                    onChange={e => setPrefundTransfer(e.target.checked)}
                    className="accent-blue-500 w-3.5 h-3.5"
                  />
                  <span>결제통장 선입금 — {bankName}으로 동일 금액 이체</span>
                </label>
              )
            })()}
```

- [ ] **Step 5: 변동 미입력 배너 추가**

기존 반복 고정지출 배너(`{pendingRecurring.length > 0 && ...}`) 바로 아래에 다음 배너를 추가:

```typescript
      {/* 변동 반복 미입력 배너 */}
      {pendingVariableTemplates.length > 0 && selectedTab !== 'transfer' && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <RefreshCw size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700">
                  이번 달 변동 지출 금액을 아직 입력하지 않았습니다 ({pendingVariableTemplates.length}건)
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {pendingVariableTemplates.map(t => (
                    <span key={t.id} className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full">
                      {t.description}
                      {t.estimatedAmount ? ` (예상 ${new Intl.NumberFormat('ko-KR').format(Number(t.estimatedAmount))}원)` : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 6: TypeScript 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 7: 커밋**

```bash
git add app/(dashboard)/budget/page.tsx
git commit -m "feat: add prefund transfer checkbox and variable recurring banner to budget page"
```

---

## Task 6: CFO 도구 업데이트

**Files:**
- Modify: `lib/agents/tools.ts`

### 배경

`get_expense_items` 핸들러에 `recurringTemplateId` 필터를 추가해 CFO가 특정 반복 템플릿의 지출 이력을 조회할 수 있게 한다.

- [ ] **Step 1: tools.ts 업데이트**

`lib/agents/tools.ts`에서 `get_expense_items` tool의 `input_schema.properties`에 추가:

```typescript
recurringTemplateId: { type: 'string', description: '반복 지출 템플릿 ID. 특정 반복 항목의 이력 조회에 사용' },
```

그리고 `get_expense_items` 핸들러의 JS 필터 부분에 추가:

현재 코드에서 `rows.filter(e => e.transferType === null)` 부분을 다음으로 교체:
```typescript
let filtered = rows.filter(e => e.transferType === null)
if (input.paymentMethodId) filtered = filtered.filter(e => e.paymentMethodId === input.paymentMethodId)
if (input.recurringTemplateId) filtered = filtered.filter(e => e.recurringTemplateId === input.recurringTemplateId)
return filtered
```

- [ ] **Step 2: TypeScript 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add lib/agents/tools.ts
git commit -m "feat: add recurringTemplateId filter to CFO get_expense_items tool"
```

---

## Task 7: 빌드 확인 + 배포

**Files:**
- 없음 (배포만)

- [ ] **Step 1: 최종 빌드 확인**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 2: 커밋되지 않은 파일 확인**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 3: develop 브랜치를 main에 머지**

```bash
git checkout main
git merge develop --no-ff -m "feat: card payment prefund + recurring templates"
git push origin main
```

Vercel이 main push를 감지해 자동 배포한다.

- [ ] **Step 4: Vercel 배포 확인**

배포 완료 후 프로덕션 URL에서 확인:
- `/settings` → 반복 지출 탭 표시 여부
- `/budget` → 지출 폼에 반복 지출 드롭다운 표시 여부
- 선입금 체크박스: 결제수단으로 현대카드 선택 시 표시 여부 (현대카드는 신한은행 linkedBankId 있음)
