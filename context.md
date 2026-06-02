# 이나네 가족자산 — Project Context

## 프로젝트 개요
부부(husband / wife) 전용 AI 통합 자산운용 플랫폼.
금융자산 포트폴리오, 부동산, 가계부, AI 에이전트 팀 (CFO / 투자 / 리스크 / 부동산 / 재무흐름).

## 기술 스택
- Next.js 16.2.6 — App Router, Turbopack
- TypeScript strict
- Tailwind CSS v4 (shadcn/ui 컴포넌트 수동 구현)
- Drizzle ORM + Neon PostgreSQL (serverless)
- NextAuth v5 (credentials provider, JWT)
- Claude API claude-sonnet-4-6 (tool use 에이전트)
- Recharts (차트), remark-gfm (마크다운 GFM 표 렌더링)

## 외부 API 결정 사항 ⚠️

### 종목 한글명 검색
- **폐기됨 (404):** `m.stock.naver.com/api/search/all`
- **현재 사용:** `https://ac.stock.naver.com/ac?q={query}&target=stock`
  - 응답: `{ items: [{ code, name, typeCode, typeName }] }`
  - 필수 헤더: `User-Agent: Mozilla/5.0 (iPhone...)`, `Referer: https://m.stock.naver.com/`

### 주식 시세 갱신
- **폐기됨:** `yahoo-finance2` npm 라이브러리 — 제거됨, 재설치 금지
- **국내 종목 (.KS / .KQ):** `https://m.stock.naver.com/api/stock/{6자리코드}/basic`
  - `closePrice` 필드가 `"356,500"` 형태의 문자열 → `.replace(/,/g, '')` 후 파싱 필요
- **해외 종목:** `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d`
  - 가격 경로: `data.chart.result[0].meta.regularMarketPrice`

### 국내/해외 종목 구분 — `lib/stock-utils.ts`
```ts
// 올바른 판별 (잘못된 includes('.') 조건 사용 금지)
isDomestic(ticker) = ticker.endsWith('.KS') || ticker.endsWith('.KQ') || /^\d{6}$/.test(ticker)
```

## DB 스키마 주요 컬럼

### expenses 테이블
- `isFixed: boolean` — 고정지출 여부
- `isRecurring: boolean` — 매월 자동 반복 여부

### income 테이블
- `isRecurring: boolean` — 반복 수입 여부

## CFO 에이전트 툴 목록 (`lib/agents/tools.ts`)
| 툴 | 설명 |
|---|---|
| `get_portfolio_summary` | 보유 종목, 평가금액, 수익률 |
| `get_real_estate_summary` | 부동산 평가손익, 임대수익 |
| `get_monthly_cashflow` | 특정 월 수입/지출 (고정/변동 구분, 저축률) |
| `get_cashflow_trend` | 최근 N개월 수입/지출 추이 |
| `get_expense_items` | 월별 지출 개별 항목 (fixedOnly, category 필터) |
| `get_income_items` | 월별 수입 개별 항목 |
| `get_recurring_expenses` | 반복 고정지출 목록 |
| `get_net_worth` | 전체 순자산 (금융 + 부동산) |

> ⚠️ `agentTools` 배열과 `executeToolCall` 분기는 수동으로 동기화해야 함 — 하나 추가 시 둘 다 수정 필요

## UI/UX 결정 사항
- **수익/손실 색상:** 한국 관례 — 수익=빨간색(`text-red-600`), 손실=파란색(`text-blue-600`)
- **`getGainColor(val)`** in `lib/stock-utils.ts` — 색상 결정 단일 진입점
- **가계부 입력 폼:** 2행 레이아웃 (금액+메모 / 날짜+추가버튼)
- **이월금액:** 전월 누적잔액 → 실질잔액 = 이월 + 이번달 순저축

## 공유 유틸리티
- `lib/stock-utils.ts` — `isDomestic`, `toNaverCode`, `getExchangeLabel`, `getGainColor`
- `lib/utils.ts` — `cn`, `formatKRW`, `CACHE_SHORT`, `CACHE_LONG`

## 환경 설정
- `.env.local` 필수: `DATABASE_URL` (Neon), `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `NEXTAUTH_URL`
- DB 초기화: PowerShell에서 `.env.local` 로드 후 `npx drizzle-kit push` → `npm run seed`
- 시드 계정: `husband@family.com` / `wife@family.com`

## 보류된 기능
- **카드사 자동 연동:** 금융결제원 오픈뱅킹/마이데이터 라이선스 필요 → 현재 범위 밖
- **CSV 업로드:** 카드사별 파서 — 향후 구현 예정
