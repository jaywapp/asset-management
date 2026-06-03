# 결제수단(카드/계좌) 관리 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가계부에 카드/계좌별 결제수단을 기록하고, 내부/외부 이체를 구분하며, Sankey 흐름 시각화와 AI 대화형 CSV/이미지 가져오기를 제공한다.

**Architecture:** Next.js 16 App Router 풀스택. `paymentMethods` 테이블 신설 + `expenses`/`income`에 FK 추가. CSV 파서 7개(기관별), Claude API 대화형 분류(analyze→resolve→confirm). Recharts Sankey로 허브 계좌 기준 이체 흐름 시각화.

**Tech Stack:** Next.js 16.2.6, TypeScript strict, Drizzle ORM, Neon PostgreSQL, @anthropic-ai/sdk, Recharts 3.8.1

---

## 파일 구조 (전체)

```
lib/db/schema.ts                           ← 수정: 새 enum + paymentMethods 테이블 + FK 컬럼
scripts/seed.ts                            ← 수정: 11개 결제수단 시드
app/api/payment-methods/route.ts           ← 신규: GET, POST
app/api/payment-methods/[id]/route.ts      ← 신규: PATCH, DELETE
app/api/budget/transfers/route.ts          ← 신규: Sankey 데이터
app/api/import/analyze/route.ts            ← 신규: CSV/이미지 → AI 분류
app/api/import/resolve/route.ts            ← 신규: 불확실 항목 답변 처리
app/api/import/confirm/route.ts            ← 신규: DB 저장
app/api/expenses/route.ts                  ← 수정: paymentMethodId/transferType 필터
app/api/income/route.ts                    ← 수정: paymentMethodId 저장
app/api/ai/analyze-image/route.ts          ← 수정: paymentMethod 반환
lib/csv-parsers/types.ts                   ← 신규: ParsedEntry, ImportSession 타입
lib/csv-parsers/index.ts                   ← 신규: detectParser + classifyWithAI
lib/csv-parsers/samsung.ts                 ← 신규
lib/csv-parsers/hyundai.ts                 ← 신규
lib/csv-parsers/shinhan.ts                 ← 신규
lib/csv-parsers/woori.ts                   ← 신규
lib/csv-parsers/kakao.ts                   ← 신규
lib/csv-parsers/hana.ts                    ← 신규
lib/csv-parsers/toss.ts                    ← 신규
lib/agents/tools.ts                        ← 수정: get_expense_items paymentMethodId 필터
components/budget/PaymentMethodTabs.tsx    ← 신규: 탭 필터 컴포넌트
components/budget/TransferSankey.tsx       ← 신규: Recharts Sankey 래퍼
components/import/ConversationalImport.tsx ← 신규: 대화형 가져오기 UI
components/settings/PaymentMethodsTab.tsx  ← 신규: 결제수단 CRUD UI
app/(dashboard)/budget/page.tsx            ← 수정: 탭 필터 + 이체 탭 + Sankey
app/(dashboard)/settings/page.tsx         ← 수정: 결제수단 탭 + 가져오기 탭
```

---

## Task 1: DB 스키마 확장

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: 새 enum 및 paymentMethods 테이블 추가**

`lib/db/schema.ts` 상단 enum 블록 뒤에 추가:

```typescript
export const paymentMethodTypeEnum = pgEnum('payment_method_type', ['credit_card', 'debit_card', 'bank'])
export const ownerEnum = pgEnum('owner', ['husband', 'wife', 'joint'])
export const transferTypeEnum = pgEnum('transfer_type', ['internal', 'external'])

export const paymentMethods = pgTable('payment_methods', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: paymentMethodTypeEnum('type').notNull(),
  institution: text('institution').notNull(),
  owner: ownerEnum('owner').notNull().default('husband'),
  isShared: boolean('is_shared').notNull().default(false),
  isHub: boolean('is_hub').notNull().default(false),
  accountNumber: text('account_number'),
  color: text('color'),
  linkedBankId: text('linked_bank_id').references((): AnyPgColumn => paymentMethods.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

import 상단에 `AnyPgColumn` 추가:
```typescript
import { pgTable, pgEnum, text, integer, boolean, decimal, timestamp } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
```

- [ ] **Step 2: expenses 테이블에 결제수단 컬럼 추가**

기존 `expenses` 테이블 정의 끝에 컬럼 추가:

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
  // 신규
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
  transferType: transferTypeEnum('transfer_type'),
  transferToId: text('transfer_to_id').references(() => paymentMethods.id),
})
```

- [ ] **Step 3: income 테이블에 결제수단 컬럼 추가**

```typescript
export const income = pgTable('income', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: incomeCatEnum('category').notNull(),
  amount: decimal('amount', { precision: 18, scale: 0 }).notNull(),
  description: text('description'),
  date: timestamp('date').notNull(),
  isRecurring: boolean('is_recurring').default(false),
  // 신규
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
})
```

- [ ] **Step 4: DB에 스키마 반영**

PowerShell에서 `.env.local` 로드 후 실행:
```powershell
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([^=]+)=(.+)$') { [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2]) }
}
npx drizzle-kit push
```

Expected: `All changes applied` — `payment_methods` 테이블 생성, `expenses`/`income`에 컬럼 추가.

- [ ] **Step 5: 커밋**

```bash
git add lib/db/schema.ts
git commit -m "feat: add paymentMethods table and payment columns to expenses/income"
```

---

## Task 2: 결제수단 시드 데이터

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: seed.ts에 paymentMethods 시드 추가**

기존 users 시드 아래에 추가:

```typescript
import { db } from '../lib/db'
import { users, paymentMethods } from '../lib/db/schema'
import bcrypt from 'bcryptjs'

async function seed() {
  const hashed = await bcrypt.hash('password123', 10)
  const [husband, wife] = await db.insert(users).values([
    { name: '남편', email: 'husband@family.com', hashedPassword: hashed, role: 'husband' },
    { name: '아내', email: 'wife@family.com', hashedPassword: hashed, role: 'wife' },
  ]).onConflictDoNothing().returning()

  // husband, wife 중 존재하는 user 가져오기
  const { users: existingUsers } = await import('../lib/db')
  const allUsers = await db.select().from(users)
  const h = allUsers.find(u => u.role === 'husband')
  const w = allUsers.find(u => u.role === 'wife')
  if (!h || !w) { console.log('Seed users not found'); process.exit(1) }

  // 기존 결제수단 삭제 후 재삽입 (멱등성)
  await db.delete(paymentMethods)

  // 은행 계좌 먼저 (카드의 linkedBankId 참조 때문)
  const banks = await db.insert(paymentMethods).values([
    { userId: h.id, name: '우리은행 (급여통장)', type: 'bank', institution: '우리은행', owner: 'husband', isShared: false, isHub: false, color: '#0066B3' },
    { userId: h.id, name: '카카오뱅크 (부부통장)', type: 'bank', institution: '카카오뱅크', owner: 'joint', isShared: true, isHub: true, color: '#FAE100' },
    { userId: h.id, name: '하나은행 (용돈통장)', type: 'bank', institution: '하나은행', owner: 'husband', isShared: false, isHub: false, color: '#009775' },
    { userId: h.id, name: '토스뱅크 (생활비)', type: 'bank', institution: '토스뱅크', owner: 'joint', isShared: true, isHub: false, color: '#0064FF' },
    { userId: h.id, name: '토스뱅크 (광주통장)', type: 'bank', institution: '토스뱅크', owner: 'joint', isShared: true, isHub: false, color: '#0064FF' },
    { userId: h.id, name: '토스뱅크 (영주통장)', type: 'bank', institution: '토스뱅크', owner: 'joint', isShared: true, isHub: false, color: '#0064FF' },
    { userId: h.id, name: '토스뱅크 (이나통장)', type: 'bank', institution: '토스뱅크', owner: 'joint', isShared: true, isHub: false, color: '#0064FF' },
    { userId: h.id, name: '신한은행 (현대카드 결제)', type: 'bank', institution: '신한은행', owner: 'husband', isShared: false, isHub: false, color: '#0046FF' },
  ]).returning()

  const shinhanBankId = banks.find(b => b.institution === '신한은행')!.id

  await db.insert(paymentMethods).values([
    { userId: h.id, name: '삼성카드', type: 'credit_card', institution: '삼성카드', owner: 'husband', isShared: false, isHub: false, color: '#1428A0' },
    { userId: h.id, name: '현대카드', type: 'credit_card', institution: '현대카드', owner: 'husband', isShared: false, isHub: false, color: '#000000', linkedBankId: shinhanBankId },
    { userId: w.id, name: '신한카드', type: 'credit_card', institution: '신한카드', owner: 'wife', isShared: false, isHub: false, color: '#0046FF' },
  ])

  console.log('Seed complete: users + paymentMethods')
  process.exit(0)
}
seed()
```

- [ ] **Step 2: 시드 실행**

```bash
npx tsx scripts/seed.ts
```

Expected: `Seed complete: users + paymentMethods`

- [ ] **Step 3: 커밋**

```bash
git add scripts/seed.ts
git commit -m "feat: seed 11 payment methods (cards + bank accounts)"
```

---

## Task 3: 결제수단 API (CRUD)

**Files:**
- Create: `app/api/payment-methods/route.ts`
- Create: `app/api/payment-methods/[id]/route.ts`

- [ ] **Step 1: GET/POST /api/payment-methods**

```typescript
// app/api/payment-methods/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { paymentMethods } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 내 것 + joint 모두 반환
  const rows = await db.select().from(paymentMethods).where(
    or(eq(paymentMethods.userId, session.user.id), eq(paymentMethods.isShared, true))
  )
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(paymentMethods).values({
    userId: session.user.id,
    name: body.name,
    type: body.type,
    institution: body.institution,
    owner: body.owner ?? 'husband',
    isShared: body.isShared ?? false,
    isHub: false,
    accountNumber: body.accountNumber,
    color: body.color,
    linkedBankId: body.linkedBankId,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
```

- [ ] **Step 2: PATCH/DELETE /api/payment-methods/[id]**

```typescript
// app/api/payment-methods/[id]/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { paymentMethods } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // isHub 변경 시: 기존 허브 해제 후 신규 지정
  if (body.isHub === true) {
    await db.update(paymentMethods)
      .set({ isHub: false })
      .where(eq(paymentMethods.isHub, true))
  }

  const [row] = await db.update(paymentMethods)
    .set({
      name: body.name,
      type: body.type,
      institution: body.institution,
      owner: body.owner,
      isShared: body.isShared,
      isHub: body.isHub,
      accountNumber: body.accountNumber,
      color: body.color,
      linkedBankId: body.linkedBankId,
    })
    .where(eq(paymentMethods.id, id))
    .returning()
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.delete(paymentMethods).where(eq(paymentMethods.id, id))
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: 커밋**

```bash
git add app/api/payment-methods/
git commit -m "feat: add payment-methods CRUD API with hub account toggle"
```

---

## Task 4: expenses/income API 업데이트

**Files:**
- Modify: `app/api/expenses/route.ts`
- Modify: `app/api/income/route.ts`

- [ ] **Step 1: expenses GET에 paymentMethodId/transferType 필터 추가**

`app/api/expenses/route.ts`의 GET 핸들러 수정:

```typescript
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const paymentMethodId = searchParams.get('paymentMethodId')
  const transferTypeParam = searchParams.get('transferType') // 'internal' | 'external' | 'none'
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const conditions = [
    eq(expenses.userId, session.user.id),
    gte(expenses.date, monthStart),
    lte(expenses.date, monthEnd),
  ]
  if (paymentMethodId) conditions.push(eq(expenses.paymentMethodId, paymentMethodId))
  if (transferTypeParam === 'none') conditions.push(isNull(expenses.transferType))
  if (transferTypeParam === 'internal') conditions.push(eq(expenses.transferType, 'internal'))
  if (transferTypeParam === 'external') conditions.push(eq(expenses.transferType, 'external'))

  const rows = await db.select().from(expenses).where(and(...conditions))
  return NextResponse.json(rows, { headers: CACHE_SHORT })
}
```

`isNull` import 추가: `import { eq, and, gte, lte, isNull } from 'drizzle-orm'`

- [ ] **Step 2: expenses POST에 새 필드 추가**

```typescript
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(expenses).values({
    userId: session.user.id,
    category: body.category,
    amount: body.amount,
    description: body.description,
    date: new Date(body.date),
    isFixed: body.isFixed ?? false,
    isRecurring: body.isRecurring ?? false,
    paymentMethodId: body.paymentMethodId ?? null,
    transferType: body.transferType ?? null,
    transferToId: body.transferToId ?? null,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
```

- [ ] **Step 3: income POST에 paymentMethodId 추가**

`app/api/income/route.ts`의 POST 핸들러:

```typescript
const [row] = await db.insert(income).values({
  userId: session.user.id,
  category: body.category,
  amount: body.amount,
  description: body.description,
  date: new Date(body.date),
  isRecurring: body.isRecurring ?? false,
  paymentMethodId: body.paymentMethodId ?? null,
}).returning()
```

- [ ] **Step 4: 커밋**

```bash
git add app/api/expenses/route.ts app/api/income/route.ts
git commit -m "feat: add paymentMethodId and transferType to expenses/income API"
```

---

## Task 5: Sankey 데이터 API

**Files:**
- Create: `app/api/budget/transfers/route.ts`

- [ ] **Step 1: GET /api/budget/transfers 작성**

```typescript
// app/api/budget/transfers/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses, paymentMethods } from '@/lib/db/schema'
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const [hub, transferRows] = await Promise.all([
    db.select().from(paymentMethods).where(eq(paymentMethods.isHub, true)).limit(1),
    db.select().from(expenses).where(and(
      eq(expenses.userId, session.user.id),
      gte(expenses.date, monthStart),
      lte(expenses.date, monthEnd),
      isNotNull(expenses.transferType),
    )),
  ])

  const allMethods = await db.select().from(paymentMethods)
  const methodMap = Object.fromEntries(allMethods.map(m => [m.id, m]))

  const flows = transferRows.map(e => ({
    fromId: e.paymentMethodId,
    fromName: e.paymentMethodId ? methodMap[e.paymentMethodId]?.name ?? '알 수 없음' : '알 수 없음',
    toId: e.transferType === 'internal' ? e.transferToId : null,
    toName: e.transferType === 'internal'
      ? (e.transferToId ? methodMap[e.transferToId]?.name ?? '알 수 없음' : '알 수 없음')
      : (e.description ?? '외부'),
    amount: Number(e.amount),
    transferType: e.transferType,
    category: e.category,
  }))

  return NextResponse.json({ hub: hub[0] ?? null, flows })
}
```

- [ ] **Step 2: 커밋**

```bash
git add app/api/budget/transfers/route.ts
git commit -m "feat: add budget/transfers API for Sankey data"
```

---

## Task 6: CSV 파서 공통 타입 + 감지 로직

**Files:**
- Create: `lib/csv-parsers/types.ts`
- Create: `lib/csv-parsers/index.ts`

- [ ] **Step 1: 타입 정의**

```typescript
// lib/csv-parsers/types.ts
export type ExpenseCategory = 'food' | 'transport' | 'housing' | 'medical' | 'education' | 'leisure' | 'subscription' | 'other'
export type IncomeCategory = 'salary' | 'bonus' | 'dividend' | 'rental' | 'freelance' | 'other'

export interface ParsedEntry {
  date: string           // YYYY-MM-DD
  amount: number         // 양수
  type: 'income' | 'expense' | 'transfer'
  description: string
  category?: ExpenseCategory | IncomeCategory
  transferType?: 'internal' | 'external'
  confidence: 'high' | 'low'
  question?: string      // AI가 생성한 불확실 항목 질문
  options?: string[]     // 객관식 선택지
  tempId: string         // 클라이언트 추적용 임시 ID
}

export interface ImportSession {
  confirmed: ParsedEntry[]
  uncertain: ParsedEntry[]
  paymentMethodId: string
}

export type CsvParser = (csvText: string) => ParsedEntry[]
```

- [ ] **Step 2: 파서 감지 로직**

```typescript
// lib/csv-parsers/index.ts
import { parseSamsung } from './samsung'
import { parseHyundai } from './hyundai'
import { parseShinhan } from './shinhan'
import { parseWoori } from './woori'
import { parseKakao } from './kakao'
import { parseHana } from './hana'
import { parseToss } from './toss'
import type { CsvParser } from './types'

const PARSERS: Array<{ name: string; detect: (fn: string, header: string) => boolean; parse: CsvParser }> = [
  {
    name: 'samsung',
    detect: (fn, h) => /samsung|삼성카드/i.test(fn) || h.includes('이용가맹점명'),
    parse: parseSamsung,
  },
  {
    name: 'hyundai',
    detect: (fn, h) => /hyundai|현대카드/i.test(fn) || h.includes('이용가맹점') && h.includes('청구금액'),
    parse: parseHyundai,
  },
  {
    name: 'shinhan',
    detect: (fn, h) => /shinhan|신한카드/i.test(fn) || h.includes('가맹점명') && h.includes('할부개월'),
    parse: parseShinhan,
  },
  {
    name: 'woori',
    detect: (fn, h) => /woori|우리은행/i.test(fn) || h.includes('적요') && h.includes('출금금액'),
    parse: parseWoori,
  },
  {
    name: 'kakao',
    detect: (fn, h) => /kakao|카카오/i.test(fn) || h.includes('거래내용') && h.includes('출금금액') && h.includes('입금금액'),
    parse: parseKakao,
  },
  {
    name: 'hana',
    detect: (fn, h) => /hana|하나은행/i.test(fn) || h.includes('거래구분') && h.includes('거래내용'),
    parse: parseHana,
  },
  {
    name: 'toss',
    detect: (fn, h) => /toss|토스/i.test(fn) || h.includes('구분') && h.includes('내용') && h.includes('잔액'),
    parse: parseToss,
  },
]

export function detectAndParse(filename: string, csvText: string): { institution: string; entries: ReturnType<CsvParser> } | null {
  const header = csvText.split('\n')[0] ?? ''
  const parser = PARSERS.find(p => p.detect(filename.toLowerCase(), header))
  if (!parser) return null
  return { institution: parser.name, entries: parser.parse(csvText) }
}

export function parseKrDate(raw: string): string {
  // "2026.06.03" | "2026-06-03" | "20260603" → "2026-06-03"
  const cleaned = raw.trim().replace(/\./g, '-')
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return cleaned.slice(0, 10)
}

export function parseKrAmount(raw: string): number {
  return Math.abs(parseInt(raw.replace(/[,\s원]/g, ''), 10) || 0)
}
```

- [ ] **Step 3: 커밋**

```bash
git add lib/csv-parsers/types.ts lib/csv-parsers/index.ts
git commit -m "feat: add CSV parser types and institution detection"
```

---

## Task 7: 카드사 CSV 파서 (삼성, 현대, 신한)

**Files:**
- Create: `lib/csv-parsers/samsung.ts`
- Create: `lib/csv-parsers/hyundai.ts`
- Create: `lib/csv-parsers/shinhan.ts`

- [ ] **Step 1: 삼성카드 파서**

삼성카드 CSV 형식: `이용일,이용가맹점명,이용금액,할부개월,포인트,할인금액`

```typescript
// lib/csv-parsers/samsung.ts
import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseSamsung(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('이용일')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).map(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, merchant, amount] = cols
    return {
      date: parseKrDate(date),
      amount: parseKrAmount(amount),
      type: 'expense' as const,
      description: merchant,
      confidence: 'low' as const,
      tempId: createId(),
    }
  }).filter(e => e.amount > 0)
}
```

- [ ] **Step 2: 현대카드 파서**

현대카드 CSV 형식: `이용일자,이용가맹점,이용금액,청구금액`

```typescript
// lib/csv-parsers/hyundai.ts
import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseHyundai(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('이용일자')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).map(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, merchant, amount] = cols
    return {
      date: parseKrDate(date),
      amount: parseKrAmount(amount),
      type: 'expense' as const,
      description: merchant,
      confidence: 'low' as const,
      tempId: createId(),
    }
  }).filter(e => e.amount > 0)
}
```

- [ ] **Step 3: 신한카드 파서**

신한카드 CSV 형식: `이용일,가맹점명,이용금액,할부개월`

```typescript
// lib/csv-parsers/shinhan.ts
import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseShinhan(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('이용일') && l.includes('가맹점')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).map(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, merchant, amount] = cols
    return {
      date: parseKrDate(date),
      amount: parseKrAmount(amount),
      type: 'expense' as const,
      description: merchant,
      confidence: 'low' as const,
      tempId: createId(),
    }
  }).filter(e => e.amount > 0)
}
```

- [ ] **Step 4: 커밋**

```bash
git add lib/csv-parsers/samsung.ts lib/csv-parsers/hyundai.ts lib/csv-parsers/shinhan.ts
git commit -m "feat: add CSV parsers for Samsung, Hyundai, Shinhan cards"
```

---

## Task 8: 은행 CSV 파서 (우리, 카카오, 하나, 토스)

**Files:**
- Create: `lib/csv-parsers/woori.ts`
- Create: `lib/csv-parsers/kakao.ts`
- Create: `lib/csv-parsers/hana.ts`
- Create: `lib/csv-parsers/toss.ts`

- [ ] **Step 1: 우리은행 파서**

우리은행 CSV 형식: `거래일자,거래시간,적요,출금금액,입금금액,잔액`

```typescript
// lib/csv-parsers/woori.ts
import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseWoori(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('거래일자') && l.includes('적요')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).flatMap(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, , desc, out, inp] = cols
    const outAmt = parseKrAmount(out)
    const inAmt = parseKrAmount(inp)
    if (outAmt === 0 && inAmt === 0) return []

    return [{
      date: parseKrDate(date),
      amount: outAmt > 0 ? outAmt : inAmt,
      type: (outAmt > 0 ? 'expense' : 'income') as 'expense' | 'income',
      description: desc,
      confidence: 'low' as const,
      tempId: createId(),
    }]
  })
}
```

- [ ] **Step 2: 카카오뱅크 파서**

카카오뱅크 CSV 형식: `거래일시,거래내용,출금금액,입금금액,잔액`

```typescript
// lib/csv-parsers/kakao.ts
import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseKakao(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('거래일시') && l.includes('출금금액')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).flatMap(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [datetime, desc, out, inp] = cols
    const outAmt = parseKrAmount(out)
    const inAmt = parseKrAmount(inp)
    if (outAmt === 0 && inAmt === 0) return []

    return [{
      date: parseKrDate(datetime.slice(0, 10)),
      amount: outAmt > 0 ? outAmt : inAmt,
      type: (outAmt > 0 ? 'expense' : 'income') as 'expense' | 'income',
      description: desc,
      confidence: 'low' as const,
      tempId: createId(),
    }]
  })
}
```

- [ ] **Step 3: 하나은행 파서**

하나은행 CSV 형식: `거래일자,거래시각,거래구분,거래내용,출금금액,입금금액,잔액`

```typescript
// lib/csv-parsers/hana.ts
import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseHana(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('거래구분') && l.includes('거래내용')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).flatMap(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, , , desc, out, inp] = cols
    const outAmt = parseKrAmount(out)
    const inAmt = parseKrAmount(inp)
    if (outAmt === 0 && inAmt === 0) return []

    return [{
      date: parseKrDate(date),
      amount: outAmt > 0 ? outAmt : inAmt,
      type: (outAmt > 0 ? 'expense' : 'income') as 'expense' | 'income',
      description: desc,
      confidence: 'low' as const,
      tempId: createId(),
    }]
  })
}
```

- [ ] **Step 4: 토스뱅크 파서**

토스뱅크 CSV 형식: `날짜,시간,구분,내용,금액(원),잔액(원)`

```typescript
// lib/csv-parsers/toss.ts
import { createId } from '@paralleldrive/cuid2'
import { parseKrDate, parseKrAmount } from './index'
import type { ParsedEntry } from './types'

export function parseToss(csvText: string): ParsedEntry[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  const dataStart = lines.findIndex(l => l.includes('날짜') && l.includes('구분')) + 1
  if (dataStart <= 0) return []

  return lines.slice(dataStart).flatMap(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const [date, , type, desc, amount] = cols
    const amt = parseKrAmount(amount)
    if (amt === 0) return []

    // 토스 '구분': '출금' | '입금' | '이체출금' | '이체입금'
    const isOut = type.includes('출금')
    return [{
      date: parseKrDate(date),
      amount: amt,
      type: (isOut ? 'expense' : 'income') as 'expense' | 'income',
      description: desc,
      confidence: 'low' as const,
      tempId: createId(),
    }]
  })
}
```

- [ ] **Step 5: 커밋**

```bash
git add lib/csv-parsers/woori.ts lib/csv-parsers/kakao.ts lib/csv-parsers/hana.ts lib/csv-parsers/toss.ts
git commit -m "feat: add CSV parsers for Woori, Kakao, Hana, Toss banks"
```

---

## Task 9: AI 대화형 분류 API

**Files:**
- Create: `app/api/import/analyze/route.ts`
- Create: `app/api/import/resolve/route.ts`
- Create: `app/api/import/confirm/route.ts`

- [ ] **Step 1: analyze API — CSV/이미지 분석 + AI 분류**

```typescript
// app/api/import/analyze/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { detectAndParse } from '@/lib/csv-parsers'
import { classifyEntries } from '@/lib/csv-parsers/classifier'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { csvText, filename, paymentMethodId } = body as {
    csvText?: string
    filename?: string
    paymentMethodId: string
  }

  if (!csvText || !filename) {
    return NextResponse.json({ error: 'csvText and filename required' }, { status: 400 })
  }

  const parsed = detectAndParse(filename, csvText)
  if (!parsed) {
    return NextResponse.json({ error: '지원하지 않는 파일 형식입니다. 기관을 수동으로 선택해주세요.', needsManualSelect: true }, { status: 422 })
  }

  const { confirmed, uncertain } = await classifyEntries(parsed.entries, paymentMethodId)
  return NextResponse.json({ confirmed, uncertain, institution: parsed.institution })
}
```

- [ ] **Step 2: AI 분류 유틸 생성**

```typescript
// lib/csv-parsers/classifier.ts
import Anthropic from '@anthropic-ai/sdk'
import { createId } from '@paralleldrive/cuid2'
import type { ParsedEntry } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function classifyEntries(
  entries: ParsedEntry[],
  paymentMethodId: string
): Promise<{ confirmed: ParsedEntry[]; uncertain: ParsedEntry[] }> {
  if (entries.length === 0) return { confirmed: [], uncertain: [] }

  const prompt = `다음 거래 내역들을 분석하여 각 항목을 분류해주세요.

거래 내역:
${entries.map((e, i) => `${i}. [${e.date}] ${e.description} ${e.amount.toLocaleString()}원 (${e.type})`).join('\n')}

각 항목에 대해 JSON 배열로 반환하세요:
[{
  "index": 0,
  "category": "food|transport|housing|medical|education|leisure|subscription|other|salary|bonus|dividend|rental|freelance",
  "transferType": null | "internal" | "external",
  "confidence": "high" | "low",
  "question": "불확실한 경우 사용자에게 물어볼 질문",
  "options": ["선택지1", "선택지2"]
}]

분류 기준:
- 은행 이체/송금이면 transferType을 추론. 내 계좌로 이동은 "internal" 의심, 외부는 "external" 의심.
- 가맹점명이 명확하면 confidence "high", 이체나 애매하면 "low"
- "low"인 항목만 question과 options 작성

반드시 유효한 JSON 배열만 반환하세요.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return { confirmed: entries.map(e => ({ ...e, confidence: 'low' as const })), uncertain: [] }

  const classifications: Array<{
    index: number
    category?: string
    transferType?: 'internal' | 'external' | null
    confidence: 'high' | 'low'
    question?: string
    options?: string[]
  }> = JSON.parse(match[0])

  const confirmed: ParsedEntry[] = []
  const uncertain: ParsedEntry[] = []

  entries.forEach((entry, i) => {
    const cls = classifications.find(c => c.index === i)
    const enriched: ParsedEntry = {
      ...entry,
      tempId: entry.tempId || createId(),
      category: (cls?.category as ParsedEntry['category']) ?? undefined,
      transferType: cls?.transferType ?? undefined,
      confidence: cls?.confidence ?? 'low',
      question: cls?.question,
      options: cls?.options,
    }
    if (enriched.confidence === 'high') {
      confirmed.push(enriched)
    } else {
      uncertain.push(enriched)
    }
  })

  return { confirmed, uncertain }
}
```

- [ ] **Step 3: resolve API — 사용자 답변 처리**

```typescript
// app/api/import/resolve/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { ParsedEntry } from '@/lib/csv-parsers/types'

interface Answer {
  tempId: string
  category?: string
  transferType?: 'internal' | 'external'
  transferToId?: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uncertain, answers }: { uncertain: ParsedEntry[]; answers: Answer[] } = await req.json()

  const resolved: ParsedEntry[] = uncertain.map(entry => {
    const answer = answers.find(a => a.tempId === entry.tempId)
    if (!answer) return entry
    return {
      ...entry,
      category: (answer.category as ParsedEntry['category']) ?? entry.category,
      transferType: answer.transferType ?? entry.transferType,
      confidence: 'high' as const,
      question: undefined,
      options: undefined,
    }
  })

  // 아직 미답변 항목 있으면 반환
  const stillUncertain = resolved.filter(e => e.confidence === 'low')
  const nowConfirmed = resolved.filter(e => e.confidence === 'high')

  return NextResponse.json({ confirmed: nowConfirmed, uncertain: stillUncertain })
}
```

- [ ] **Step 4: confirm API — DB 저장**

```typescript
// app/api/import/confirm/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses, income } from '@/lib/db/schema'
import type { ParsedEntry } from '@/lib/csv-parsers/types'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entries, paymentMethodId }: { entries: ParsedEntry[]; paymentMethodId: string } = await req.json()

  const expenseEntries = entries.filter(e => e.type === 'expense' || e.type === 'transfer')
  const incomeEntries = entries.filter(e => e.type === 'income')

  const [savedExpenses, savedIncome] = await Promise.all([
    expenseEntries.length > 0
      ? db.insert(expenses).values(expenseEntries.map(e => ({
          userId: session.user.id,
          category: (e.category as any) ?? 'other',
          amount: String(e.amount),
          description: e.description,
          date: new Date(e.date),
          isFixed: false,
          isRecurring: false,
          paymentMethodId,
          transferType: e.transferType ?? null,
          transferToId: null,
        }))).returning()
      : Promise.resolve([]),
    incomeEntries.length > 0
      ? db.insert(income).values(incomeEntries.map(e => ({
          userId: session.user.id,
          category: (e.category as any) ?? 'other',
          amount: String(e.amount),
          description: e.description,
          date: new Date(e.date),
          isRecurring: false,
          paymentMethodId,
        }))).returning()
      : Promise.resolve([]),
  ])

  return NextResponse.json({ saved: savedExpenses.length + savedIncome.length })
}
```

- [ ] **Step 5: 커밋**

```bash
git add app/api/import/ lib/csv-parsers/classifier.ts
git commit -m "feat: add conversational import API (analyze/resolve/confirm) with AI classification"
```

---

## Task 10: 가계부 UI — 결제수단 탭 + Sankey

**Files:**
- Create: `components/budget/PaymentMethodTabs.tsx`
- Create: `components/budget/TransferSankey.tsx`
- Modify: `app/(dashboard)/budget/page.tsx`

- [ ] **Step 1: PaymentMethodTabs 컴포넌트**

```typescript
// components/budget/PaymentMethodTabs.tsx
'use client'
import type { InferSelectModel } from 'drizzle-orm'
import type { paymentMethods } from '@/lib/db/schema'

type PaymentMethod = InferSelectModel<typeof paymentMethods>

interface Props {
  methods: PaymentMethod[]
  selected: string | null  // null = 전체
  onChange: (id: string | null) => void
}

export function PaymentMethodTabs({ methods, selected, onChange }: Props) {
  return (
    <div className="flex gap-2 flex-wrap pb-3 border-b">
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          selected === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        전체
      </button>
      {methods.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selected === m.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={selected === m.id ? { backgroundColor: m.color ?? '#3b82f6' } : {}}
        >
          {m.name}
        </button>
      ))}
      <button
        onClick={() => onChange('transfer')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          selected === 'transfer' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        이체
      </button>
    </div>
  )
}
```

- [ ] **Step 2: TransferSankey 컴포넌트**

```typescript
// components/budget/TransferSankey.tsx
'use client'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'

interface Flow {
  fromName: string
  toName: string
  amount: number
  transferType: 'internal' | 'external'
}

interface Props {
  hubName: string
  flows: Flow[]
}

export function TransferSankey({ hubName, flows }: Props) {
  if (flows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">이체 내역이 없습니다.</p>
  }

  // recharts Sankey 노드/링크 변환
  const nodeNames: string[] = [hubName]
  flows.forEach(f => {
    if (!nodeNames.includes(f.toName)) nodeNames.push(f.toName)
  })

  const nodeMap = Object.fromEntries(nodeNames.map((n, i) => [n, i]))
  const links = flows.map(f => ({
    source: nodeMap[f.fromName] ?? 0,
    target: nodeMap[f.toName] ?? 1,
    value: f.amount,
    transferType: f.transferType,
  }))

  const nodes = nodeNames.map((name, i) => ({
    name,
    fill: i === 0 ? '#1d4ed8' : flows.find(f => f.toName === name)?.transferType === 'external' ? '#dc2626' : '#134e4a',
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <Sankey
        data={{ nodes, links }}
        nodeWidth={12}
        nodePadding={20}
        margin={{ top: 10, right: 120, bottom: 10, left: 10 }}
        link={{ stroke: '#d1d5db', strokeOpacity: 0.4 }}
      >
        <Tooltip
          formatter={(value: number) =>
            new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value)
          }
        />
      </Sankey>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: 가계부 페이지에 탭 필터 + 이체 탭 + Sankey 통합**

`app/(dashboard)/budget/page.tsx` — 기존 파일을 아래로 교체 (지출 입력 폼의 결제수단 드롭다운 추가):

```typescript
'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaymentMethodTabs } from '@/components/budget/PaymentMethodTabs'
import { TransferSankey } from '@/components/budget/TransferSankey'
import { formatKRW } from '@/lib/utils'

export default function BudgetPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedTab, setSelectedTab] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [incomeItems, setIncomeItems] = useState<any[]>([])
  const [expenseItems, setExpenseItems] = useState<any[]>([])
  const [transferData, setTransferData] = useState<{ hub: any; flows: any[] } | null>(null)

  useEffect(() => {
    fetch('/api/payment-methods').then(r => r.json()).then(setPaymentMethods)
  }, [])

  useEffect(() => {
    if (selectedTab === 'transfer') {
      fetch(`/api/budget/transfers?year=${year}&month=${month}`).then(r => r.json()).then(setTransferData)
      return
    }
    const pmParam = selectedTab ? `&paymentMethodId=${selectedTab}` : ''
    Promise.all([
      fetch(`/api/income?year=${year}&month=${month}`).then(r => r.json()),
      fetch(`/api/expenses?year=${year}&month=${month}${pmParam}&transferType=none`).then(r => r.json()),
    ]).then(([inc, exp]) => { setIncomeItems(inc); setExpenseItems(exp) })
  }, [year, month, selectedTab])

  const totalIncome = incomeItems.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenseItems.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">재무흐름</h1>

      <PaymentMethodTabs
        methods={paymentMethods}
        selected={selectedTab}
        onChange={setSelectedTab}
      />

      {selectedTab === 'transfer' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              이체 흐름
              {transferData?.hub && (
                <span className="text-xs text-gray-400 font-normal">허브: {transferData.hub.name}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransferSankey
              hubName={transferData?.hub?.name ?? '허브 계좌'}
              flows={transferData?.flows ?? []}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 text-center">
            <Card><CardContent className="pt-4">
              <p className="text-xs text-gray-500">수입</p>
              <p className="text-xl font-bold text-green-600">{formatKRW(totalIncome)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-gray-500">지출</p>
              <p className="text-xl font-bold text-red-500">{formatKRW(totalExpenses)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-gray-500">순저축</p>
              <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatKRW(totalIncome - totalExpenses)}
              </p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>수입 내역</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {incomeItems.map(i => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{i.description || i.category}</span>
                    <span className="text-green-600 font-medium">{formatKRW(Number(i.amount))}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>지출 내역</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {expenseItems.map(e => (
                  <div key={e.id} className="flex justify-between text-sm items-center">
                    <div>
                      <span className="text-gray-600">{e.description || e.category}</span>
                      {e.paymentMethodId && (
                        <span className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {paymentMethods.find(m => m.id === e.paymentMethodId)?.name ?? ''}
                        </span>
                      )}
                    </div>
                    <span className="text-red-500 font-medium">{formatKRW(Number(e.amount))}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add components/budget/ app/(dashboard)/budget/page.tsx
git commit -m "feat: add payment method tabs and transfer Sankey to budget page"
```

---

## Task 11: 설정 UI — 결제수단 + 대화형 가져오기

**Files:**
- Create: `components/settings/PaymentMethodsTab.tsx`
- Create: `components/import/ConversationalImport.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: PaymentMethodsTab 컴포넌트**

```typescript
// components/settings/PaymentMethodsTab.tsx
'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function PaymentMethodsTab() {
  const [methods, setMethods] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', type: 'bank', institution: '', owner: 'husband', isShared: false, color: '#3b82f6' })

  async function load() {
    const res = await fetch('/api/payment-methods')
    setMethods(await res.json())
  }

  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    load()
    setForm({ name: '', type: 'bank', institution: '', owner: 'husband', isShared: false, color: '#3b82f6' })
  }

  async function setHub(id: string) {
    await fetch(`/api/payment-methods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHub: true }),
    })
    load()
  }

  async function del(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/payment-methods/${id}`, { method: 'DELETE' })
    load()
  }

  const typeLabel = { credit_card: '신용카드', debit_card: '체크카드', bank: '은행' }
  const ownerLabel = { husband: '남편', wife: '아내', joint: '공동' }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {methods.map(m => (
          <div key={m.id} className="flex items-center justify-between border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color ?? '#9ca3af' }} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm">{m.name}</span>
                  <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{typeLabel[m.type as keyof typeof typeLabel]}</span>
                  <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{ownerLabel[m.owner as keyof typeof ownerLabel]}</span>
                  {m.isHub && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">허브</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              {!m.isHub && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setHub(m.id)}>허브 지정</Button>}
              <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500" onClick={() => del(m.id)}>삭제</Button>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={add} className="grid grid-cols-2 gap-3">
            <div><Label>이름</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
            <div><Label>기관</Label><Input value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} required /></div>
            <div>
              <Label>종류</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">은행</SelectItem>
                  <SelectItem value="credit_card">신용카드</SelectItem>
                  <SelectItem value="debit_card">체크카드</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>소유</Label>
              <Select value={form.owner} onValueChange={v => setForm(p => ({ ...p, owner: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="husband">남편</SelectItem>
                  <SelectItem value="wife">아내</SelectItem>
                  <SelectItem value="joint">공동</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex gap-3 items-end">
              <div className="flex-1"><Label>색상</Label><Input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} /></div>
              <Button type="submit">추가</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: ConversationalImport 컴포넌트**

```typescript
// components/import/ConversationalImport.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, HelpCircle } from 'lucide-react'
import type { ParsedEntry } from '@/lib/csv-parsers/types'
import { formatKRW } from '@/lib/utils'

type Step = 'idle' | 'analyzing' | 'resolving' | 'confirming' | 'done'

export function ConversationalImport({ paymentMethods }: { paymentMethods: any[] }) {
  const [pmId, setPmId] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [confirmed, setConfirmed] = useState<ParsedEntry[]>([])
  const [uncertain, setUncertain] = useState<ParsedEntry[]>([])
  const [answers, setAnswers] = useState<Record<string, Partial<ParsedEntry>>>({})
  const [savedCount, setSavedCount] = useState(0)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pmId) return
    setStep('analyzing')
    const csvText = await file.text()
    const res = await fetch('/api/import/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText, filename: file.name, paymentMethodId: pmId }),
    })
    const data = await res.json()
    if (data.needsManualSelect) { alert(data.error); setStep('idle'); return }
    setConfirmed(data.confirmed)
    setUncertain(data.uncertain)
    setStep(data.uncertain.length > 0 ? 'resolving' : 'confirming')
  }

  async function submitAnswers() {
    const answerList = Object.entries(answers).map(([tempId, ans]) => ({ tempId, ...ans }))
    const res = await fetch('/api/import/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uncertain, answers: answerList }),
    })
    const data = await res.json()
    setConfirmed(prev => [...prev, ...data.confirmed])
    setUncertain(data.uncertain)
    if (data.uncertain.length === 0) setStep('confirming')
  }

  async function save() {
    const res = await fetch('/api/import/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: confirmed, paymentMethodId: pmId }),
    })
    const data = await res.json()
    setSavedCount(data.saved)
    setStep('done')
  }

  if (step === 'done') return (
    <div className="text-center py-8">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <p className="font-medium">{savedCount}건 저장 완료</p>
      <Button className="mt-4" variant="outline" onClick={() => { setStep('idle'); setConfirmed([]); setUncertain([]) }}>다시 가져오기</Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">결제수단</label>
          <Select value={pmId} onValueChange={setPmId}>
            <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
            <SelectContent>{paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className={`cursor-pointer ${!pmId ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="border rounded-md px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100">CSV 파일 선택</div>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {step === 'analyzing' && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          AI가 거래내역을 분류하고 있습니다...
        </div>
      )}

      {(step === 'resolving') && uncertain.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><HelpCircle className="w-4 h-4 text-amber-500" />확인이 필요한 항목 {uncertain.length}건</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {uncertain.map(entry => (
              <div key={entry.tempId} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{entry.description}</span>
                  <span className="text-gray-500">{formatKRW(entry.amount)} · {entry.date}</span>
                </div>
                {entry.question && <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded">{entry.question}</p>}
                {entry.options && (
                  <div className="flex gap-2 flex-wrap">
                    {entry.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setAnswers(prev => ({ ...prev, [entry.tempId]: { ...prev[entry.tempId], category: opt as any } }))}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          answers[entry.tempId]?.category === opt
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button onClick={submitAnswers} className="w-full">답변 제출</Button>
          </CardContent>
        </Card>
      )}

      {step === 'confirming' && (
        <Card>
          <CardHeader><CardTitle className="text-sm">저장할 항목 {confirmed.length}건</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
              {confirmed.map(e => (
                <div key={e.tempId} className="flex justify-between text-sm py-1 border-b">
                  <span>{e.description}</span>
                  <span className={e.type === 'income' ? 'text-green-600' : 'text-red-500'}>{formatKRW(e.amount)}</span>
                </div>
              ))}
            </div>
            <Button onClick={save} className="w-full">전체 저장</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 3: settings/page.tsx에 탭 추가**

기존 `app/(dashboard)/settings/page.tsx`의 `<Tabs>` 블록에 두 탭 추가:

```typescript
// 기존 import에 추가
import { PaymentMethodsTab } from '@/components/settings/PaymentMethodsTab'
import { ConversationalImport } from '@/components/import/ConversationalImport'

// Tabs 부분 — TabsList에 추가:
<TabsTrigger value="payment-methods">결제수단</TabsTrigger>
<TabsTrigger value="import">가져오기</TabsTrigger>

// TabsContent 추가:
<TabsContent value="payment-methods">
  <PaymentMethodsTab />
</TabsContent>
<TabsContent value="import">
  <ConversationalImport paymentMethods={/* useState로 관리 */[]} />
</TabsContent>
```

`settings/page.tsx` 상단에 `paymentMethods` state 추가:
```typescript
const [paymentMethods, setPaymentMethods] = useState<any[]>([])
useEffect(() => {
  fetch('/api/payment-methods').then(r => r.json()).then(setPaymentMethods)
}, [])
```

- [ ] **Step 4: 커밋**

```bash
git add components/settings/ components/import/ app/(dashboard)/settings/page.tsx
git commit -m "feat: add payment methods settings tab and conversational CSV import UI"
```

---

## Task 12: 이미지 분석 + CFO 툴 업데이트

**Files:**
- Modify: `app/api/ai/analyze-image/route.ts`
- Modify: `lib/agents/tools.ts`

- [ ] **Step 1: analyze-image 프롬프트에 paymentMethod 추가**

`app/api/ai/analyze-image/route.ts`의 `PROMPTS.budget` 수정:

```typescript
budget: `이 이미지는 은행 거래내역, 카드 사용내역, 영수증, 또는 출금내역입니다.
이미지에서 거래 내역을 추출하여 다음 JSON 형식으로 반환하세요. 반드시 JSON만 반환하고 다른 텍스트는 포함하지 마세요.

{
  "paymentMethod": "이미지에 표시된 카드명 또는 계좌명 (예: '삼성카드', '토스뱅크', '현대카드'). 확인 불가시 null",
  "entries": [
    {
      "type": "income" 또는 "expense",
      "amount": 숫자 (원화 기준),
      "description": "거래 설명",
      "category": "salary|bonus|dividend|rental|freelance|other|food|transport|housing|medical|education|leisure|subscription",
      "date": "YYYY-MM-DD",
      "confidence": "high" 또는 "low"
    }
  ]
}

카테고리 선택 기준:
- 급여/월급 → salary, 상여 → bonus, 배당 → dividend, 임대 → rental
- 식당/카페/마트 → food, 교통/주유 → transport, 월세/관리비 → housing
- 병원/약국 → medical, 학원/도서 → education, 영화/여가 → leisure
- 정기결제/구독 → subscription, 나머지 수입 → other(income), 나머지 지출 → other(expense)

날짜가 없으면 오늘 날짜(${new Date().toISOString().split('T')[0]})를 사용하세요.`,
```

- [ ] **Step 2: get_expense_items 툴에 paymentMethodId 필터 추가**

`lib/agents/tools.ts`의 `get_expense_items` tool 정의:

```typescript
{
  name: 'get_expense_items',
  description: '특정 월의 지출 항목 목록을 조회한다. 결제수단별 필터 가능',
  input_schema: {
    type: 'object' as const,
    properties: {
      year: { type: 'number', description: '연도' },
      month: { type: 'number', description: '월 (1-12)' },
      fixedOnly: { type: 'boolean', description: 'true면 고정지출만' },
      category: { type: 'string', description: '카테고리 필터' },
      paymentMethodId: { type: 'string', description: '결제수단 ID (선택). 이 값이 있으면 해당 카드/계좌 지출만 조회' },
    },
    required: ['year', 'month'],
  },
},
```

`executeToolCall`의 `get_expense_items` 처리 블록에 paymentMethodId 조건 추가:

```typescript
if (name === 'get_expense_items') {
  const { year, month, fixedOnly, category, paymentMethodId } = input as {
    year: number; month: number; fixedOnly?: boolean; category?: string; paymentMethodId?: string
  }
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  const conditions = [
    eq(expenses.userId, userId),
    gte(expenses.date, start),
    lte(expenses.date, end),
    isNull(expenses.transferType),
  ]
  if (fixedOnly) conditions.push(eq(expenses.isFixed, true))
  if (category) conditions.push(eq(expenses.category, category as any))
  if (paymentMethodId) conditions.push(eq(expenses.paymentMethodId, paymentMethodId))

  const rows = await db.select().from(expenses).where(and(...conditions))
  return JSON.stringify(rows.map(e => ({
    date: e.date, description: e.description, category: e.category,
    amount: Number(e.amount), isFixed: e.isFixed,
  })))
}
```

`isNull` import 추가: `import { eq, inArray, gte, lte, and, desc, isNull } from 'drizzle-orm'`

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```

Expected: `✓ Compiled successfully`. 오류 시 TypeScript 에러 수정 후 재실행.

- [ ] **Step 4: 커밋**

```bash
git add app/api/ai/analyze-image/route.ts lib/agents/tools.ts
git commit -m "feat: update image analysis and CFO tools with paymentMethod support"
```

---

## Task 13: .gitignore + PROJECTS.md 업데이트

**Files:**
- Modify: `.gitignore`
- Modify: `D:\workspace\repositories\PROJECTS.md`

- [ ] **Step 1: .gitignore에 .superpowers 추가**

`.gitignore`에 추가:
```
.superpowers/
```

- [ ] **Step 2: 최종 동작 확인 체크리스트**

```bash
npm run dev
```

- [ ] `/settings` → 결제수단 탭 → 목록 11개 표시
- [ ] `/settings` → 결제수단 탭 → 허브 지정 버튼 클릭 → 카카오뱅크 허브 해제, 선택 계좌 허브 지정
- [ ] `/settings` → 가져오기 탭 → CSV 업로드 → 대화형 분류 흐름
- [ ] `/budget` → 결제수단 탭 클릭 → 해당 카드 지출만 필터링
- [ ] `/budget` → 이체 탭 → Sankey 렌더링 (이체 데이터 있을 때)
- [ ] 지출 입력 시 결제수단 선택 → 저장 후 탭 필터 반영

- [ ] **Step 3: 최종 커밋**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```
