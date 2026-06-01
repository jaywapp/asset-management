# 가족 AI 자산운용 솔루션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부부가 함께 사용하는 AI 기반 통합 자산운용 플랫폼 — 금융자산, 부동산, 가계부를 전문가 AI 에이전트 팀이 자동 모니터링하고 분석

**Architecture:** Next.js 14 App Router 풀스택. Claude API tool use로 5개 전문 에이전트(CFO, 투자, 리스크, 부동산, 재무흐름)가 협력. PostgreSQL(Neon) + Drizzle ORM으로 데이터 관리. 부부 2계정을 NextAuth v5 credentials로 인증.

**Tech Stack:** Next.js 14, TypeScript, shadcn/ui, Recharts, Drizzle ORM, Neon PostgreSQL, NextAuth v5, Anthropic SDK (@anthropic-ai/sdk), bcryptjs, node-cron

---

## 파일 구조

```
D:\Agents\AssetManagement\
├── app/
│   ├── (auth)/login/page.tsx          # 로그인 페이지
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # 사이드바 포함 인증된 레이아웃
│   │   ├── dashboard/page.tsx         # 홈 대시보드
│   │   ├── portfolio/page.tsx         # 금융자산 포트폴리오
│   │   ├── real-estate/page.tsx       # 부동산
│   │   ├── budget/page.tsx            # 재무흐름(가계부)
│   │   ├── ai-team/page.tsx           # AI 에이전트 팀
│   │   └── settings/page.tsx         # 설정
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── assets/summary/route.ts
│   │   ├── portfolio/
│   │   │   ├── accounts/route.ts
│   │   │   └── holdings/route.ts
│   │   ├── real-estate/route.ts
│   │   ├── income/route.ts
│   │   ├── expenses/route.ts
│   │   ├── budgets/route.ts
│   │   ├── agents/
│   │   │   ├── chat/route.ts
│   │   │   └── report/route.ts
│   │   └── cron/
│   │       ├── daily/route.ts
│   │       ├── weekly/route.ts
│   │       └── monthly/route.ts
│   ├── layout.tsx
│   └── page.tsx                       # / → /dashboard redirect
├── lib/
│   ├── db/
│   │   ├── schema.ts                  # Drizzle 전체 스키마
│   │   └── index.ts                   # DB 연결
│   ├── agents/
│   │   ├── tools.ts                   # Claude tool 정의 + DB 조회 함수
│   │   ├── cfo.ts                     # CFO 에이전트
│   │   ├── investment.ts              # 투자분석 에이전트
│   │   ├── risk.ts                    # 리스크 매니저
│   │   ├── real-estate-agent.ts       # 부동산 에이전트
│   │   └── budget-agent.ts            # 재무흐름 에이전트
│   └── auth.ts                        # NextAuth 설정
├── components/
│   ├── layout/Sidebar.tsx
│   ├── dashboard/
│   │   ├── NetWorthCard.tsx
│   │   ├── MonthlyFlowCard.tsx
│   │   └── AIBriefingCard.tsx
│   ├── portfolio/
│   │   ├── HoldingsTable.tsx
│   │   └── AllocationChart.tsx
│   ├── budget/
│   │   ├── CashFlowChart.tsx
│   │   └── CategoryPieChart.tsx
│   └── ai-team/
│       ├── ChatInterface.tsx
│       └── ReportCard.tsx
├── middleware.ts                       # 인증 라우트 보호
├── drizzle.config.ts
└── .env.local
```

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `D:\Agents\AssetManagement\` (전체 프로젝트)
- Create: `.env.local`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Next.js 앱 생성**

```bash
cd D:\Agents\AssetManagement
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

Expected: `Success! Created family-asset-mgmt`

- [ ] **Step 2: 핵심 의존성 설치**

```bash
npm install @anthropic-ai/sdk drizzle-orm @neondatabase/serverless drizzle-kit
npm install next-auth@beta @auth/drizzle-adapter
npm install bcryptjs @paralleldrive/cuid2
npm install recharts
npm install -D @types/bcryptjs
```

- [ ] **Step 3: shadcn/ui 초기화**

```bash
npx shadcn@latest init --yes
npx shadcn@latest add button card input label badge table tabs select dialog form
```

- [ ] **Step 4: .env.local 생성**

```env
DATABASE_URL=postgresql://your-neon-connection-string
AUTH_SECRET=your-32-char-random-secret-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
CRON_SECRET=your-cron-secret-here
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **Step 5: drizzle.config.ts 작성**

```typescript
import type { Config } from 'drizzle-kit'
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
```

- [ ] **Step 6: package.json에 DB 스크립트 추가**

`package.json`의 `"scripts"` 에 추가:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

- [ ] **Step 7: 커밋**

```bash
git init
git add .
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: 데이터베이스 스키마

**Files:**
- Create: `lib/db/schema.ts`
- Create: `lib/db/index.ts`

- [ ] **Step 1: schema.ts 작성**

```typescript
// lib/db/schema.ts
import {
  pgTable, pgEnum, text, integer, boolean,
  decimal, timestamp,
} from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const userRoleEnum = pgEnum('user_role', ['husband', 'wife'])
export const accountTypeEnum = pgEnum('account_type', ['stock', 'fund', 'deposit', 'crypto', 'saving'])
export const txTypeEnum = pgEnum('tx_type', ['buy', 'sell', 'dividend', 'deposit', 'withdraw'])
export const incomeCatEnum = pgEnum('income_category', ['salary', 'bonus', 'dividend', 'rental', 'freelance', 'other'])
export const expenseCatEnum = pgEnum('expense_category', ['food', 'transport', 'housing', 'medical', 'education', 'leisure', 'subscription', 'other'])
export const reportTypeEnum = pgEnum('report_type', ['daily', 'weekly', 'monthly', 'on_demand'])

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  institution: text('institution'),
  currency: text('currency').notNull().default('KRW'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const holdings = pgTable('holdings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  ticker: text('ticker').notNull(),
  name: text('name').notNull(),
  quantity: decimal('quantity', { precision: 18, scale: 8 }).notNull(),
  avgPrice: decimal('avg_price', { precision: 18, scale: 4 }).notNull(),
  currentPrice: decimal('current_price', { precision: 18, scale: 4 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  type: txTypeEnum('type').notNull(),
  ticker: text('ticker'),
  quantity: decimal('quantity', { precision: 18, scale: 8 }),
  price: decimal('price', { precision: 18, scale: 4 }),
  fee: decimal('fee', { precision: 18, scale: 4 }).default('0'),
  date: timestamp('date').notNull(),
  memo: text('memo'),
})

export const realEstate = pgTable('real_estate', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  purchasePrice: decimal('purchase_price', { precision: 18, scale: 0 }).notNull(),
  currentValue: decimal('current_value', { precision: 18, scale: 0 }).notNull(),
  purchaseDate: timestamp('purchase_date').notNull(),
  monthlyRentalIncome: decimal('monthly_rental_income', { precision: 18, scale: 0 }).default('0'),
  propertyTax: decimal('property_tax', { precision: 18, scale: 0 }).default('0'),
})

export const income = pgTable('income', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: incomeCatEnum('category').notNull(),
  amount: decimal('amount', { precision: 18, scale: 0 }).notNull(),
  description: text('description'),
  date: timestamp('date').notNull(),
  isRecurring: boolean('is_recurring').default(false),
})

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: expenseCatEnum('category').notNull(),
  amount: decimal('amount', { precision: 18, scale: 0 }).notNull(),
  description: text('description'),
  date: timestamp('date').notNull(),
  isFixed: boolean('is_fixed').default(false),
})

export const budgets = pgTable('budgets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: expenseCatEnum('category').notNull(),
  amount: decimal('amount', { precision: 18, scale: 0 }).notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
})

export const aiReports = pgTable('ai_reports', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  type: reportTypeEnum('type').notNull(),
  agent: text('agent').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

- [ ] **Step 2: DB 연결 (lib/db/index.ts)**

```typescript
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 3: 마이그레이션 생성 및 실행**

```bash
npm run db:push
```

Expected: `All changes applied` (Neon DB에 테이블 생성)

- [ ] **Step 4: 커밋**

```bash
git add lib/db/ drizzle.config.ts
git commit -m "feat: add Drizzle ORM schema and DB connection"
```

---

## Task 3: 인증 (NextAuth v5)

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: lib/auth.ts 작성**

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.hashedPassword)
        if (!valid) return null
        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = (user as any).role }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      ;(session.user as any).role = token.role
      return session
    },
  },
  pages: { signIn: '/login' },
})
```

- [ ] **Step 2: API route 작성**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 3: middleware.ts로 대시보드 보호**

```typescript
// middleware.ts
export { auth as middleware } from '@/lib/auth'
export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: 로그인 페이지 작성**

```typescript
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: fd.get('email'),
      password: fd.get('password'),
      redirect: false,
    })
    if (result?.error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">가족 자산관리</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full">로그인</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: 초기 사용자 시드 스크립트 작성 (scripts/seed.ts)**

```typescript
// scripts/seed.ts
import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import bcrypt from 'bcryptjs'

async function seed() {
  const hashed = await bcrypt.hash('password123', 10)
  await db.insert(users).values([
    { name: '남편', email: 'husband@family.com', hashedPassword: hashed, role: 'husband' },
    { name: '아내', email: 'wife@family.com', hashedPassword: hashed, role: 'wife' },
  ]).onConflictDoNothing()
  console.log('Seed complete')
  process.exit(0)
}
seed()
```

- [ ] **Step 6: 시드 실행**

```bash
npx tsx scripts/seed.ts
```

Expected: `Seed complete`

- [ ] **Step 7: 로그인 동작 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/login` → husband@family.com / password123 로그인 → `/dashboard` 리다이렉트 확인

- [ ] **Step 8: 커밋**

```bash
git add lib/auth.ts app/api/auth middleware.ts app/\(auth\) scripts/
git commit -m "feat: add NextAuth v5 credentials authentication"
```

---

## Task 4: 앱 셸 (레이아웃 + 사이드바)

**Files:**
- Create: `components/layout/Sidebar.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Sidebar 컴포넌트 작성**

```typescript
// components/layout/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, TrendingUp, Building2,
  Wallet, Bot, Settings, LogOut
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/portfolio', label: '포트폴리오', icon: TrendingUp },
  { href: '/real-estate', label: '부동산', icon: Building2 },
  { href: '/budget', label: '재무흐름', icon: Wallet },
  { href: '/ai-team', label: 'AI 팀', icon: Bot },
  { href: '/settings', label: '설정', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 shrink-0 border-r bg-white h-screen flex flex-col">
      <div className="px-6 py-5 border-b">
        <h1 className="font-bold text-lg">가족 자산관리</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-gray-600 hover:bg-gray-100"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Dashboard layout 작성**

```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: 루트 페이지를 dashboard로 리다이렉트**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
export default function RootPage() {
  redirect('/dashboard')
}
```

- [ ] **Step 4: lucide-react 설치**

```bash
npm install lucide-react
```

- [ ] **Step 5: 커밋**

```bash
git add components/layout app/\(dashboard\)/layout.tsx app/page.tsx
git commit -m "feat: add app shell with sidebar navigation"
```

---

## Task 5: 포트폴리오 API

**Files:**
- Create: `app/api/portfolio/accounts/route.ts`
- Create: `app/api/portfolio/holdings/route.ts`
- Create: `app/api/assets/summary/route.ts`

- [ ] **Step 1: accounts API 작성**

```typescript
// app/api/portfolio/accounts/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select().from(accounts).where(eq(accounts.userId, session.user.id))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(accounts).values({
    userId: session.user.id,
    name: body.name,
    type: body.type,
    institution: body.institution,
    currency: body.currency ?? 'KRW',
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
```

- [ ] **Step 2: holdings API 작성**

```typescript
// app/api/portfolio/holdings/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { holdings, accounts } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userAccounts = await db.select({ id: accounts.id })
    .from(accounts).where(eq(accounts.userId, session.user.id))
  const accountIds = userAccounts.map(a => a.id)
  if (!accountIds.length) return NextResponse.json([])

  const rows = await db.select().from(holdings)
    .where(inArray(holdings.accountId, accountIds))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(holdings).values({
    accountId: body.accountId,
    ticker: body.ticker,
    name: body.name,
    quantity: body.quantity,
    avgPrice: body.avgPrice,
    currentPrice: body.currentPrice,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.update(holdings)
    .set({ currentPrice: body.currentPrice, updatedAt: new Date() })
    .where(eq(holdings.id, body.id))
    .returning()
  return NextResponse.json(row)
}
```

- [ ] **Step 3: assets summary API 작성**

```typescript
// app/api/assets/summary/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accounts, holdings, realEstate, income, expenses } from '@/lib/db/schema'
import { eq, inArray, gte, lte, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [userAccounts, userRealEstate, monthIncome, monthExpenses] = await Promise.all([
    db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(realEstate).where(eq(realEstate.userId, userId)),
    db.select().from(income).where(and(
      eq(income.userId, userId),
      gte(income.date, monthStart),
      lte(income.date, monthEnd),
    )),
    db.select().from(expenses).where(and(
      eq(expenses.userId, userId),
      gte(expenses.date, monthStart),
      lte(expenses.date, monthEnd),
    )),
  ])

  const accountIds = userAccounts.map(a => a.id)
  const userHoldings = accountIds.length
    ? await db.select().from(holdings).where(inArray(holdings.accountId, accountIds))
    : []

  const portfolioValue = userHoldings.reduce(
    (sum, h) => sum + Number(h.quantity) * Number(h.currentPrice), 0
  )
  const portfolioCost = userHoldings.reduce(
    (sum, h) => sum + Number(h.quantity) * Number(h.avgPrice), 0
  )
  const realEstateValue = userRealEstate.reduce((sum, r) => sum + Number(r.currentValue), 0)
  const totalIncome = monthIncome.reduce((sum, i) => sum + Number(i.amount), 0)
  const totalExpenses = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return NextResponse.json({
    netWorth: portfolioValue + realEstateValue,
    portfolioValue,
    portfolioGainLoss: portfolioValue - portfolioCost,
    portfolioGainLossPct: portfolioCost > 0 ? ((portfolioValue - portfolioCost) / portfolioCost) * 100 : 0,
    realEstateValue,
    monthlyIncome: totalIncome,
    monthlyExpenses: totalExpenses,
    monthlySavings: totalIncome - totalExpenses,
  })
}
```

- [ ] **Step 4: 커밋**

```bash
git add app/api/
git commit -m "feat: add portfolio accounts, holdings, and assets summary APIs"
```

---

## Task 6: 부동산 + 가계부 API

**Files:**
- Create: `app/api/real-estate/route.ts`
- Create: `app/api/income/route.ts`
- Create: `app/api/expenses/route.ts`
- Create: `app/api/budgets/route.ts`

- [ ] **Step 1: real-estate API**

```typescript
// app/api/real-estate/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { realEstate } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select().from(realEstate).where(eq(realEstate.userId, session.user.id))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(realEstate).values({
    userId: session.user.id,
    name: body.name,
    address: body.address,
    purchasePrice: body.purchasePrice,
    currentValue: body.currentValue,
    purchaseDate: new Date(body.purchaseDate),
    monthlyRentalIncome: body.monthlyRentalIncome ?? '0',
    propertyTax: body.propertyTax ?? '0',
  }).returning()
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.update(realEstate)
    .set({ currentValue: body.currentValue })
    .where(eq(realEstate.id, body.id))
    .returning()
  return NextResponse.json(row)
}
```

- [ ] **Step 2: income API**

```typescript
// app/api/income/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { income } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const rows = await db.select().from(income).where(and(
    eq(income.userId, session.user.id),
    gte(income.date, monthStart),
    lte(income.date, monthEnd),
  ))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(income).values({
    userId: session.user.id,
    category: body.category,
    amount: body.amount,
    description: body.description,
    date: new Date(body.date),
    isRecurring: body.isRecurring ?? false,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
```

- [ ] **Step 3: expenses API**

```typescript
// app/api/expenses/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { expenses } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const rows = await db.select().from(expenses).where(and(
    eq(expenses.userId, session.user.id),
    gte(expenses.date, monthStart),
    lte(expenses.date, monthEnd),
  ))
  return NextResponse.json(rows)
}

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
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
```

- [ ] **Step 4: budgets API**

```typescript
// app/api/budgets/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const rows = await db.select().from(budgets).where(and(
    eq(budgets.userId, session.user.id),
    eq(budgets.year, year),
    eq(budgets.month, month),
  ))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const [row] = await db.insert(budgets).values({
    userId: session.user.id,
    category: body.category,
    amount: body.amount,
    month: body.month,
    year: body.year,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
```

- [ ] **Step 5: 커밋**

```bash
git add app/api/real-estate app/api/income app/api/expenses app/api/budgets
git commit -m "feat: add real-estate, income, expenses, budgets CRUD APIs"
```

---

## Task 7: 대시보드 UI

**Files:**
- Create: `components/dashboard/NetWorthCard.tsx`
- Create: `components/dashboard/MonthlyFlowCard.tsx`
- Create: `components/dashboard/AIBriefingCard.tsx`
- Create: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: NetWorthCard 컴포넌트**

```typescript
// components/dashboard/NetWorthCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  netWorth: number
  portfolioValue: number
  realEstateValue: number
  gainLossPct: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export function NetWorthCard({ netWorth, portfolioValue, realEstateValue, gainLossPct }: Props) {
  const isUp = gainLossPct >= 0
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-500">순자산</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{fmt(netWorth)}</p>
        <div className="flex items-center gap-1 mt-1">
          {isUp ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
          <span className={`text-sm ${isUp ? 'text-green-600' : 'text-red-600'}`}>
            {isUp ? '+' : ''}{gainLossPct.toFixed(2)}%
          </span>
        </div>
        <div className="mt-3 flex gap-4 text-sm text-gray-500">
          <span>금융 {fmt(portfolioValue)}</span>
          <span>부동산 {fmt(realEstateValue)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: MonthlyFlowCard 컴포넌트**

```typescript
// components/dashboard/MonthlyFlowCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

interface Props { income: number; expenses: number; savings: number }

export function MonthlyFlowCard({ income, expenses, savings }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-500">이번달 재무흐름</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">수입</span>
          <span className="text-green-600 font-medium">{fmt(income)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">지출</span>
          <span className="text-red-500 font-medium">{fmt(expenses)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between text-sm font-semibold">
          <span>순저축</span>
          <span className={savings >= 0 ? 'text-blue-600' : 'text-red-600'}>{fmt(savings)}</span>
        </div>
        {income > 0 && (
          <p className="text-xs text-gray-400">저축률 {((savings / income) * 100).toFixed(1)}%</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: AIBriefingCard 컴포넌트**

```typescript
// components/dashboard/AIBriefingCard.tsx
'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, Loader2 } from 'lucide-react'

export function AIBriefingCard() {
  const [briefing, setBriefing] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agents/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'on_demand', agentType: 'cfo', prompt: '오늘의 자산 현황을 2-3문장으로 브리핑해줘.' }),
    })
      .then(r => r.json())
      .then(d => setBriefing(d.content))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="border-blue-100 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-blue-600 flex items-center gap-2">
          <Bot size={16} />
          CFO 브리핑
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 size={16} className="animate-spin text-blue-400" />
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed">{briefing}</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: 대시보드 페이지 작성**

```typescript
// app/(dashboard)/dashboard/page.tsx
import { auth } from '@/lib/auth'
import { NetWorthCard } from '@/components/dashboard/NetWorthCard'
import { MonthlyFlowCard } from '@/components/dashboard/MonthlyFlowCard'
import { AIBriefingCard } from '@/components/dashboard/AIBriefingCard'

async function getSummary() {
  // 서버 컴포넌트에서 직접 API 호출 대신 DB 조회 가능하지만,
  // 클라이언트 재사용을 위해 fetch 사용
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/assets/summary`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export default async function DashboardPage() {
  const session = await auth()
  const summary = await getSummary()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">안녕하세요, {session?.user?.name}님</h1>
        <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NetWorthCard
          netWorth={summary?.netWorth ?? 0}
          portfolioValue={summary?.portfolioValue ?? 0}
          realEstateValue={summary?.realEstateValue ?? 0}
          gainLossPct={summary?.portfolioGainLossPct ?? 0}
        />
        <MonthlyFlowCard
          income={summary?.monthlyIncome ?? 0}
          expenses={summary?.monthlyExpenses ?? 0}
          savings={summary?.monthlySavings ?? 0}
        />
        <AIBriefingCard />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 커밋**

```bash
git add components/dashboard app/\(dashboard\)/dashboard
git commit -m "feat: add dashboard homepage with net worth, cash flow, and AI briefing"
```

---

## Task 8: 포트폴리오 + 부동산 + 가계부 UI

**Files:**
- Create: `components/portfolio/HoldingsTable.tsx`
- Create: `components/portfolio/AllocationChart.tsx`
- Create: `app/(dashboard)/portfolio/page.tsx`
- Create: `app/(dashboard)/real-estate/page.tsx`
- Create: `components/budget/CashFlowChart.tsx`
- Create: `app/(dashboard)/budget/page.tsx`

- [ ] **Step 1: HoldingsTable 컴포넌트**

```typescript
// components/portfolio/HoldingsTable.tsx
'use client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Holding {
  id: string; ticker: string; name: string
  quantity: string; avgPrice: string; currentPrice: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
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
          return (
            <TableRow key={h.id}>
              <TableCell>
                <div className="font-medium">{h.ticker}</div>
                <div className="text-xs text-gray-500">{h.name}</div>
              </TableCell>
              <TableCell className="text-right">{qty}</TableCell>
              <TableCell className="text-right">{fmt(avg)}</TableCell>
              <TableCell className="text-right">{fmt(cur)}</TableCell>
              <TableCell className="text-right font-medium">{fmt(value)}</TableCell>
              <TableCell className="text-right">
                <Badge variant={pct >= 0 ? 'default' : 'destructive'}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: AllocationChart 컴포넌트**

```typescript
// components/portfolio/AllocationChart.tsx
'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

interface Props { data: { name: string; value: number }[] }

export function AllocationChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
          dataKey="value" nameKey="name">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) =>
          new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(v)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: 포트폴리오 페이지**

```typescript
// app/(dashboard)/portfolio/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HoldingsTable } from '@/components/portfolio/HoldingsTable'
import { AllocationChart } from '@/components/portfolio/AllocationChart'

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState([])
  useEffect(() => {
    fetch('/api/portfolio/holdings').then(r => r.json()).then(setHoldings)
  }, [])

  const allocationData = [
    { name: '국내주식', value: holdings.filter((h: any) => !h.ticker.includes('.')).reduce((s: number, h: any) => s + Number(h.quantity) * Number(h.currentPrice), 0) },
    { name: '해외주식', value: holdings.filter((h: any) => h.ticker.includes('.')).reduce((s: number, h: any) => s + Number(h.quantity) * Number(h.currentPrice), 0) },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">포트폴리오</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>자산배분</CardTitle></CardHeader>
          <CardContent><AllocationChart data={allocationData} /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>보유 종목</CardTitle></CardHeader>
        <CardContent><HoldingsTable holdings={holdings} /></CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: 부동산 페이지**

```typescript
// app/(dashboard)/real-estate/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export default function RealEstatePage() {
  const [properties, setProperties] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/real-estate').then(r => r.json()).then(setProperties)
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">부동산</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.map(p => {
          const gain = Number(p.currentValue) - Number(p.purchasePrice)
          const gainPct = (gain / Number(p.purchasePrice)) * 100
          return (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="text-xs text-gray-500">{p.address}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">현재가</span>
                  <span className="font-semibold">{fmt(Number(p.currentValue))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">매입가</span>
                  <span>{fmt(Number(p.purchasePrice))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">평가손익</span>
                  <Badge variant={gain >= 0 ? 'default' : 'destructive'}>
                    {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct.toFixed(1)}%)
                  </Badge>
                </div>
                {Number(p.monthlyRentalIncome) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">월 임대수입</span>
                    <span className="text-green-600">{fmt(Number(p.monthlyRentalIncome))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: CashFlowChart 컴포넌트**

```typescript
// components/budget/CashFlowChart.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface MonthData { month: string; income: number; expenses: number }

export function CashFlowChart({ data }: { data: MonthData[] }) {
  const fmt = (v: number) =>
    new Intl.NumberFormat('ko-KR', { notation: 'compact', currency: 'KRW' }).format(v)
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <XAxis dataKey="month" />
        <YAxis tickFormatter={fmt} />
        <Tooltip formatter={(v: number) =>
          new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(v)} />
        <Legend />
        <Bar dataKey="income" name="수입" fill="#10b981" />
        <Bar dataKey="expenses" name="지출" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 6: 가계부 페이지**

```typescript
// app/(dashboard)/budget/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CashFlowChart } from '@/components/budget/CashFlowChart'

const fmt = (n: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)

export default function BudgetPage() {
  const now = new Date()
  const [incomeItems, setIncomeItems] = useState<any[]>([])
  const [expenseItems, setExpenseItems] = useState<any[]>([])

  useEffect(() => {
    const y = now.getFullYear(); const m = now.getMonth() + 1
    Promise.all([
      fetch(`/api/income?year=${y}&month=${m}`).then(r => r.json()),
      fetch(`/api/expenses?year=${y}&month=${m}`).then(r => r.json()),
    ]).then(([inc, exp]) => { setIncomeItems(inc); setExpenseItems(exp) })
  }, [])

  const totalIncome = incomeItems.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenseItems.reduce((s, i) => s + Number(i.amount), 0)

  const chartData = [{ month: `${now.getMonth() + 1}월`, income: totalIncome, expenses: totalExpenses }]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">재무흐름</h1>
      <div className="grid grid-cols-3 gap-4 text-center">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">수입</p>
          <p className="text-xl font-bold text-green-600">{fmt(totalIncome)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">지출</p>
          <p className="text-xl font-bold text-red-500">{fmt(totalExpenses)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">순저축</p>
          <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {fmt(totalIncome - totalExpenses)}
          </p>
        </CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>현금흐름</CardTitle></CardHeader>
        <CardContent><CashFlowChart data={chartData} /></CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>수입 내역</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {incomeItems.map(i => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{i.description || i.category}</span>
                <span className="text-green-600 font-medium">{fmt(Number(i.amount))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>지출 내역</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {expenseItems.map(e => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{e.description || e.category}</span>
                <span className="text-red-500 font-medium">{fmt(Number(e.amount))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 커밋**

```bash
git add components/ app/\(dashboard\)/portfolio app/\(dashboard\)/real-estate app/\(dashboard\)/budget
git commit -m "feat: add portfolio, real-estate, and budget UI pages"
```

---

## Task 9: Claude AI 에이전트 프레임워크

**Files:**
- Create: `lib/agents/tools.ts`
- Create: `lib/agents/cfo.ts`
- Create: `lib/agents/investment.ts`
- Create: `lib/agents/risk.ts`
- Create: `lib/agents/real-estate-agent.ts`
- Create: `lib/agents/budget-agent.ts`

- [ ] **Step 1: 에이전트 툴 정의 (lib/agents/tools.ts)**

```typescript
// lib/agents/tools.ts
import { db } from '@/lib/db'
import { accounts, holdings, realEstate, income, expenses, aiReports } from '@/lib/db/schema'
import { eq, inArray, gte, lte, and, desc } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

export type Tool = Anthropic.Tool

export const agentTools: Tool[] = [
  {
    name: 'get_portfolio_summary',
    description: '모든 보유 종목과 평가금액, 수익률을 조회한다',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_real_estate_summary',
    description: '보유 부동산 목록과 평가손익을 조회한다',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_monthly_cashflow',
    description: '특정 월의 수입과 지출 합계를 조회한다',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '연도' },
        month: { type: 'number', description: '월 (1-12)' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'get_net_worth',
    description: '전체 순자산(금융+부동산) 합계를 조회한다',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
]

type ToolInput = Record<string, unknown>

export async function executeToolCall(name: string, input: ToolInput, userId: string): Promise<string> {
  if (name === 'get_portfolio_summary') {
    const userAccounts = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId))
    const ids = userAccounts.map(a => a.id)
    if (!ids.length) return JSON.stringify({ holdings: [], totalValue: 0, totalGainLoss: 0 })
    const rows = await db.select().from(holdings).where(inArray(holdings.accountId, ids))
    const summary = rows.map(h => {
      const qty = Number(h.quantity)
      const value = qty * Number(h.currentPrice)
      const cost = qty * Number(h.avgPrice)
      return { ticker: h.ticker, name: h.name, value, gainLoss: value - cost, gainLossPct: ((value - cost) / cost) * 100 }
    })
    return JSON.stringify({ holdings: summary, totalValue: summary.reduce((s, h) => s + h.value, 0) })
  }

  if (name === 'get_real_estate_summary') {
    const rows = await db.select().from(realEstate).where(eq(realEstate.userId, userId))
    return JSON.stringify(rows.map(r => ({
      name: r.name,
      currentValue: Number(r.currentValue),
      gainLoss: Number(r.currentValue) - Number(r.purchasePrice),
      monthlyRental: Number(r.monthlyRentalIncome),
    })))
  }

  if (name === 'get_monthly_cashflow') {
    const { year, month } = input as { year: number; month: number }
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    const [inc, exp] = await Promise.all([
      db.select().from(income).where(and(eq(income.userId, userId), gte(income.date, start), lte(income.date, end))),
      db.select().from(expenses).where(and(eq(expenses.userId, userId), gte(expenses.date, start), lte(expenses.date, end))),
    ])
    return JSON.stringify({
      totalIncome: inc.reduce((s, i) => s + Number(i.amount), 0),
      totalExpenses: exp.reduce((s, e) => s + Number(e.amount), 0),
      incomeByCategory: inc.reduce((acc: Record<string, number>, i) => { acc[i.category] = (acc[i.category] ?? 0) + Number(i.amount); return acc }, {}),
      expensesByCategory: exp.reduce((acc: Record<string, number>, e) => { acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount); return acc }, {}),
    })
  }

  if (name === 'get_net_worth') {
    const userAccounts = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId))
    const ids = userAccounts.map(a => a.id)
    const [userHoldings, reList] = await Promise.all([
      ids.length ? db.select().from(holdings).where(inArray(holdings.accountId, ids)) : Promise.resolve([]),
      db.select().from(realEstate).where(eq(realEstate.userId, userId)),
    ])
    const portfolioValue = userHoldings.reduce((s, h) => s + Number(h.quantity) * Number(h.currentPrice), 0)
    const reValue = reList.reduce((s, r) => s + Number(r.currentValue), 0)
    return JSON.stringify({ portfolioValue, realEstateValue: reValue, netWorth: portfolioValue + reValue })
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` })
}
```

- [ ] **Step 2: CFO 에이전트 (lib/agents/cfo.ts)**

```typescript
// lib/agents/cfo.ts
import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runCFOAgent(prompt: string, userId: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt },
  ]

  const systemPrompt = `당신은 가족 자산관리 CFO입니다. 포트폴리오, 부동산, 현금흐름 데이터를 조회하여 
명확하고 실용적인 한국어 분석을 제공합니다. 숫자는 한국 원화(₩) 형식으로 표시하고, 
전문 용어보다 이해하기 쉬운 표현을 사용하세요.`

  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    tools: agentTools,
    messages,
  })

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      const result = await executeToolCall(toolUse.name, toolUse.input as Record<string, unknown>, userId)
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
    }

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools: agentTools,
      messages,
    })
  }

  const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
  return textBlock?.text ?? ''
}

export async function saveCFOReport(content: string, type: 'daily' | 'weekly' | 'monthly' | 'on_demand') {
  await db.insert(aiReports).values({ type, agent: 'cfo', content })
}
```

- [ ] **Step 3: 투자분석 에이전트 (lib/agents/investment.ts)**

```typescript
// lib/agents/investment.ts
import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runInvestmentAgent(prompt: string, userId: string): Promise<string> {
  const system = `당신은 가족 포트폴리오 투자분석 전문가입니다. 보유 종목의 수익률, 자산배분, 
집중도 리스크를 분석하고 리밸런싱이 필요한 경우 구체적인 방향을 제시합니다. 
단순 정보 나열이 아닌 인사이트 중심으로 분석하세요.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 2048, system, tools: agentTools, messages,
  })

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const t of toolUseBlocks) {
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: await executeToolCall(t.name, t.input as Record<string, unknown>, userId) })
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
    response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2048, system, tools: agentTools, messages })
  }

  return (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
}
```

- [ ] **Step 4: 리스크 매니저 에이전트 (lib/agents/risk.ts)**

```typescript
// lib/agents/risk.ts
import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runRiskAgent(userId: string): Promise<string> {
  const prompt = `현재 포트폴리오의 리스크를 점검해주세요. 특히:
1. 단일 종목이 전체의 20% 초과 여부
2. 자산 유형 집중도 문제
3. 주의가 필요한 사항
을 체크하고 경고 사항이 있으면 명확히 알려주세요.`

  const system = `당신은 가족 포트폴리오 리스크 매니저입니다. 리스크를 명확하게 식별하고 
실행 가능한 조언을 제공하세요. 문제가 없으면 간결하게 "이상 없음"으로 보고하세요.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1024, system, tools: agentTools, messages,
  })

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const t of toolUseBlocks) {
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: await executeToolCall(t.name, t.input as Record<string, unknown>, userId) })
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
    response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024, system, tools: agentTools, messages })
  }

  const content = (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
  await db.insert(aiReports).values({ type: 'daily', agent: 'risk', content })
  return content
}
```

- [ ] **Step 5: 부동산/재무흐름 에이전트 (lib/agents/real-estate-agent.ts, budget-agent.ts)**

```typescript
// lib/agents/real-estate-agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runRealEstateAgent(prompt: string, userId: string): Promise<string> {
  const system = `당신은 부동산 자산 분석 전문가입니다. 보유 부동산의 수익률, 임대수익, 
평가손익을 분석하고 한국 부동산 시장 관점에서 실용적인 조언을 제공합니다.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1024, system, tools: agentTools, messages,
  })
  while (response.stop_reason === 'tool_use') {
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const t of response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]) {
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: await executeToolCall(t.name, t.input as Record<string, unknown>, userId) })
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
    response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024, system, tools: agentTools, messages })
  }
  return (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
}
```

```typescript
// lib/agents/budget-agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { agentTools, executeToolCall } from './tools'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runBudgetAgent(userId: string): Promise<string> {
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const prompt = `${prevYear}년 ${prevMonth}월 가계부를 결산하고 다음달 예산 제안을 해주세요.
수입/지출 분석, 저축률, 개선 포인트를 포함해주세요.`

  const system = `당신은 가족 재무흐름 분석가입니다. 수입과 지출 패턴을 분석하고 
저축률 개선을 위한 실용적이고 구체적인 제안을 제공합니다.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 2048, system, tools: agentTools, messages,
  })
  while (response.stop_reason === 'tool_use') {
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const t of response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]) {
      toolResults.push({ type: 'tool_result', tool_use_id: t.id, content: await executeToolCall(t.name, t.input as Record<string, unknown>, userId) })
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
    response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2048, system, tools: agentTools, messages })
  }

  const content = (response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? ''
  await db.insert(aiReports).values({ type: 'monthly', agent: 'budget', content })
  return content
}
```

- [ ] **Step 6: 커밋**

```bash
git add lib/agents/
git commit -m "feat: add Claude AI agent team (CFO, investment, risk, real-estate, budget)"
```

---

## Task 10: AI 에이전트 API Routes

**Files:**
- Create: `app/api/agents/chat/route.ts`
- Create: `app/api/agents/report/route.ts`

- [ ] **Step 1: chat API (CFO와 자유 대화)**

```typescript
// app/api/agents/chat/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runCFOAgent } from '@/lib/agents/cfo'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
  const reply = await runCFOAgent(message, session.user.id)
  return NextResponse.json({ content: reply })
}
```

- [ ] **Step 2: report API (에이전트별 리포트 생성)**

```typescript
// app/api/agents/report/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runCFOAgent, saveCFOReport } from '@/lib/agents/cfo'
import { runInvestmentAgent } from '@/lib/agents/investment'
import { runRiskAgent } from '@/lib/agents/risk'
import { runRealEstateAgent } from '@/lib/agents/real-estate-agent'
import { runBudgetAgent } from '@/lib/agents/budget-agent'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentType, prompt, type = 'on_demand' } = await req.json()
  const userId = session.user.id
  let content = ''

  switch (agentType) {
    case 'cfo':
      content = await runCFOAgent(prompt ?? '전체 자산 현황을 간략히 브리핑해줘.', userId)
      await saveCFOReport(content, type)
      break
    case 'investment':
      content = await runInvestmentAgent(prompt ?? '포트폴리오 분석과 리밸런싱 제안을 해줘.', userId)
      break
    case 'risk':
      content = await runRiskAgent(userId)
      break
    case 'real-estate':
      content = await runRealEstateAgent(prompt ?? '부동산 자산 현황을 분석해줘.', userId)
      break
    case 'budget':
      content = await runBudgetAgent(userId)
      break
    default:
      return NextResponse.json({ error: 'Unknown agent type' }, { status: 400 })
  }

  return NextResponse.json({ content })
}
```

- [ ] **Step 3: 커밋**

```bash
git add app/api/agents/
git commit -m "feat: add agent chat and report API routes"
```

---

## Task 11: AI 팀 페이지

**Files:**
- Create: `components/ai-team/ChatInterface.tsx`
- Create: `components/ai-team/ReportCard.tsx`
- Create: `app/(dashboard)/ai-team/page.tsx`

- [ ] **Step 1: ChatInterface 컴포넌트**

```typescript
// components/ai-team/ChatInterface.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message { role: 'user' | 'assistant'; content: string }

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '안녕하세요! 가족 자산관리 CFO입니다. 자산에 대해 궁금한 것이 있으면 무엇이든 물어보세요.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg overflow-hidden bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              msg.role === 'assistant' ? 'bg-blue-100' : 'bg-gray-100')}>
              {msg.role === 'assistant' ? <Bot size={16} className="text-blue-600" /> : <User size={16} className="text-gray-600" />}
            </div>
            <div className={cn('max-w-[80%] rounded-lg px-4 py-2 text-sm',
              msg.role === 'assistant' ? 'bg-blue-50 text-gray-800' : 'bg-gray-100 text-gray-800')}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot size={16} className="text-blue-600" />
            </div>
            <div className="bg-blue-50 rounded-lg px-4 py-2">
              <Loader2 size={16} className="animate-spin text-blue-400" />
            </div>
          </div>
        )}
      </div>
      <div className="border-t p-3 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="CFO에게 질문하세요... (예: 이번달 저축률은?)"
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon">
          <Send size={16} />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: ReportCard 컴포넌트**

```typescript
// components/ai-team/ReportCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot } from 'lucide-react'

const agentLabels: Record<string, string> = {
  cfo: 'CFO',
  risk: '리스크 매니저',
  investment: '투자분석',
  'real-estate': '부동산',
  budget: '재무흐름',
}

const typeLabels: Record<string, string> = {
  daily: '일간', weekly: '주간', monthly: '월간', on_demand: '수시',
}

interface Props {
  agent: string
  type: string
  content: string
  createdAt: string
}

export function ReportCard({ agent, type, content, createdAt }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot size={14} className="text-blue-500" />
            {agentLabels[agent] ?? agent}
          </CardTitle>
          <div className="flex gap-1">
            <Badge variant="secondary">{typeLabels[type] ?? type}</Badge>
            <span className="text-xs text-gray-400">
              {new Date(createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-6">{content}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: AI 팀 페이지**

```typescript
// app/(dashboard)/ai-team/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ChatInterface } from '@/components/ai-team/ChatInterface'
import { ReportCard } from '@/components/ai-team/ReportCard'
import { Loader2, RefreshCw } from 'lucide-react'

export default function AITeamPage() {
  const [reports, setReports] = useState<any[]>([])
  const [generating, setGenerating] = useState<string | null>(null)

  async function loadReports() {
    const res = await fetch('/api/agents/reports')
    if (res.ok) setReports(await res.json())
  }

  async function generateReport(agentType: string) {
    setGenerating(agentType)
    await fetch('/api/agents/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentType, type: 'on_demand' }),
    })
    await loadReports()
    setGenerating(null)
  }

  useEffect(() => { loadReports() }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI 에이전트 팀</h1>
      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">CFO와 대화</TabsTrigger>
          <TabsTrigger value="reports">리포트</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-4">
          <ChatInterface />
        </TabsContent>
        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['risk', 'investment', 'real-estate', 'budget'].map(agent => (
              <Button key={agent} variant="outline" size="sm"
                onClick={() => generateReport(agent)}
                disabled={generating === agent}>
                {generating === agent ? <Loader2 size={14} className="mr-1 animate-spin" /> : <RefreshCw size={14} className="mr-1" />}
                {agent === 'risk' ? '리스크 체크' : agent === 'investment' ? '투자 분석' : agent === 'real-estate' ? '부동산 분석' : '가계부 결산'}
              </Button>
            ))}
          </div>
          {reports.length === 0
            ? <p className="text-gray-400 text-sm">리포트가 없습니다. 위 버튼으로 생성하세요.</p>
            : reports.map((r: any) => <ReportCard key={r.id} {...r} />)
          }
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: reports 조회 API 추가**

```typescript
// app/api/agents/reports/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select().from(aiReports).orderBy(desc(aiReports.createdAt)).limit(20)
  return NextResponse.json(rows)
}
```

- [ ] **Step 5: 커밋**

```bash
git add components/ai-team app/\(dashboard\)/ai-team app/api/agents/reports
git commit -m "feat: add AI team page with chat interface and report cards"
```

---

## Task 12: Cron 자동화

**Files:**
- Create: `app/api/cron/daily/route.ts`
- Create: `app/api/cron/weekly/route.ts`
- Create: `app/api/cron/monthly/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: daily cron (리스크 매니저)**

```typescript
// app/api/cron/daily/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { runRiskAgent } from '@/lib/agents/risk'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allUsers = await db.select({ id: users.id }).from(users)
  const processed = new Set<string>()

  for (const user of allUsers) {
    if (!processed.has(user.id)) {
      await runRiskAgent(user.id)
      processed.add(user.id)
    }
  }

  return NextResponse.json({ success: true, usersProcessed: processed.size })
}
```

- [ ] **Step 2: weekly cron (CFO 주간 리포트)**

```typescript
// app/api/cron/weekly/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { runCFOAgent, saveCFOReport } from '@/lib/agents/cfo'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allUsers = await db.select({ id: users.id }).from(users)
  const processed = new Set<string>()

  for (const user of allUsers) {
    if (!processed.has(user.id)) {
      const content = await runCFOAgent(
        '이번 주 포트폴리오 성과를 분석하고 다음 주 주목할 사항을 정리해줘.',
        user.id
      )
      await saveCFOReport(content, 'weekly')
      processed.add(user.id)
    }
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: monthly cron (재무흐름 월간 결산)**

```typescript
// app/api/cron/monthly/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { runBudgetAgent } from '@/lib/agents/budget-agent'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allUsers = await db.select({ id: users.id }).from(users)
  const processed = new Set<string>()

  for (const user of allUsers) {
    if (!processed.has(user.id)) {
      await runBudgetAgent(user.id)
      processed.add(user.id)
    }
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Vercel Cron 설정**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 23 * * *"
    },
    {
      "path": "/api/cron/weekly",
      "schedule": "0 22 * * 0"
    },
    {
      "path": "/api/cron/monthly",
      "schedule": "0 21 1 * *"
    }
  ]
}
```

- [ ] **Step 5: 커밋**

```bash
git add app/api/cron vercel.json
git commit -m "feat: add daily/weekly/monthly cron automation with Vercel Cron"
```

---

## Task 13: 설정 페이지 + 마무리

**Files:**
- Create: `app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: 설정 페이지 (계좌/자산 등록 폼)**

```typescript
// app/(dashboard)/settings/page.tsx
'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SettingsPage() {
  const [accountForm, setAccountForm] = useState({ name: '', type: '', institution: '' })
  const [holdingForm, setHoldingForm] = useState({ accountId: '', ticker: '', name: '', quantity: '', avgPrice: '', currentPrice: '' })

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/portfolio/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountForm),
    })
    setAccountForm({ name: '', type: '', institution: '' })
    alert('계좌가 추가되었습니다.')
  }

  async function addHolding(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/portfolio/holdings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdingForm),
    })
    setHoldingForm({ accountId: '', ticker: '', name: '', quantity: '', avgPrice: '', currentPrice: '' })
    alert('종목이 추가되었습니다.')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">설정</h1>
      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">계좌 추가</TabsTrigger>
          <TabsTrigger value="holdings">종목 추가</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <Card>
            <CardHeader><CardTitle>계좌 추가</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addAccount} className="space-y-4">
                <div><Label>계좌명</Label><Input value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} required /></div>
                <div>
                  <Label>유형</Label>
                  <Select onValueChange={v => setAccountForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {['stock', 'fund', 'deposit', 'crypto', 'saving'].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>증권사/은행</Label><Input value={accountForm.institution} onChange={e => setAccountForm(p => ({ ...p, institution: e.target.value }))} /></div>
                <Button type="submit">추가</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="holdings">
          <Card>
            <CardHeader><CardTitle>종목 추가</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addHolding} className="space-y-4">
                <div><Label>계좌 ID</Label><Input value={holdingForm.accountId} onChange={e => setHoldingForm(p => ({ ...p, accountId: e.target.value }))} required /></div>
                <div><Label>티커</Label><Input value={holdingForm.ticker} onChange={e => setHoldingForm(p => ({ ...p, ticker: e.target.value }))} required /></div>
                <div><Label>종목명</Label><Input value={holdingForm.name} onChange={e => setHoldingForm(p => ({ ...p, name: e.target.value }))} required /></div>
                <div><Label>수량</Label><Input type="number" value={holdingForm.quantity} onChange={e => setHoldingForm(p => ({ ...p, quantity: e.target.value }))} required /></div>
                <div><Label>평균단가</Label><Input type="number" value={holdingForm.avgPrice} onChange={e => setHoldingForm(p => ({ ...p, avgPrice: e.target.value }))} required /></div>
                <div><Label>현재가</Label><Input type="number" value={holdingForm.currentPrice} onChange={e => setHoldingForm(p => ({ ...p, currentPrice: e.target.value }))} required /></div>
                <Button type="submit">추가</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: 전체 빌드 확인**

```bash
npm run build
```

Expected: `✓ Compiled successfully`  
오류 발생 시 타입 에러 수정 후 재실행

- [ ] **Step 3: 로컬 전체 기능 확인**

```bash
npm run dev
```

체크리스트:
- [ ] `/login` → 로그인 성공 → `/dashboard` 리다이렉트
- [ ] 사이드바 네비게이션 6개 링크 모두 동작
- [ ] `/dashboard` — 순자산/현금흐름 카드 렌더링
- [ ] `/portfolio` — Holdings 테이블 (데이터 없으면 빈 상태)
- [ ] `/real-estate` — 부동산 카드
- [ ] `/budget` — 수입/지출 차트
- [ ] `/ai-team` — 채팅 인터페이스, CFO 응답 확인
- [ ] `/settings` — 계좌/종목 추가 폼

- [ ] **Step 4: 최종 커밋**

```bash
git add app/\(dashboard\)/settings
git commit -m "feat: add settings page and complete initial implementation"
```

---

## 환경변수 체크리스트

Vercel 배포 전 필수 설정:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `AUTH_SECRET` — 32자 이상 랜덤 문자열 (`openssl rand -base64 32`)
- `ANTHROPIC_API_KEY` — Anthropic Console에서 발급
- `CRON_SECRET` — Cron 엔드포인트 보호용 시크릿
- `NEXTAUTH_URL` — 배포 후 실제 도메인으로 변경
