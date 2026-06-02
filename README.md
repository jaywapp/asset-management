# 이나네 가족자산 관리 (Family Asset Management)

부부 전용 AI 통합 자산운용 플랫폼. 금융 포트폴리오, 부동산, 가계부를 하나의 대시보드에서 관리하고, Claude AI 에이전트 팀이 CFO 분석과 투자·리스크 리포트를 자동 생성합니다.

---

## 주요 기능

### 대시보드
- 전체 순자산(금융 + 부동산) 요약 및 월별 현금흐름 브리핑
- 페이지 전환 진행 바, 사이드바 내비게이션

### 포트폴리오 관리
- 증권 계좌(주식·펀드·예금·암호화폐·적금) 등록 및 보유 종목 관리
- 국내 종목(`.KS` / `.KQ` / 6자리) — 네이버 주식 API로 시세 자동 갱신
- 해외 종목 — Yahoo Finance API로 시세 자동 갱신
- 한국 색상 관례(수익=빨간색, 손실=파란색)

### 부동산
- 매입가 / 현재가 / 임대수입 / 재산세 등록 및 평가손익 조회

### 가계부 (Budget)
- 수입·지출 입력 (2행 레이아웃: 금액+메모 / 날짜+추가)
- 고정지출(`isFixed`) / 반복지출(`isRecurring`) 구분
- 월별 예산 설정, 카테고리별 집계, 이월금액·실질잔액 계산
- 반복 지출 자동 등록

### AI 에이전트 팀
| 에이전트 | 역할 |
|---|---|
| CFO | 포트폴리오·부동산·현금흐름 종합 분석 (tool-use 방식) |
| 투자 | 보유 종목 평가 및 매수/매도 제언 |
| 리스크 | 자산 집중 위험·변동성 분석 |
| 부동산 | 부동산 평가 및 임대 수익 검토 |
| 재무흐름 | 예산 달성률·저축률 분석 |

CFO 에이전트는 다음 도구를 사용합니다:
`get_portfolio_summary`, `get_real_estate_summary`, `get_monthly_cashflow`, `get_cashflow_trend`, `get_expense_items`, `get_income_items`, `get_recurring_expenses`, `get_net_worth`

### 자동 리포트 (Cron)
- 일간 / 주간 / 월간 AI 리포트 자동 생성 및 저장

---

## 기술 스택

| 항목 | 내용 |
|---|---|
| 프레임워크 | Next.js 16.2.6 (App Router, Turbopack) |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS v4, shadcn/ui 컴포넌트 수동 구현 |
| DB | Drizzle ORM + Neon PostgreSQL (serverless) |
| 인증 | NextAuth v5 (credentials provider, JWT) |
| AI | Anthropic Claude API — claude-sonnet-4-6 (tool use) |
| 차트 | Recharts |
| 마크다운 | react-markdown + remark-gfm |

---

## 환경 설정

`.env.local` 파일에 아래 변수를 설정합니다:

```
DATABASE_URL=       # Neon PostgreSQL 연결 문자열
AUTH_SECRET=        # NextAuth 서명 시크릿
ANTHROPIC_API_KEY=  # Claude API 키
NEXTAUTH_URL=       # 배포 URL (예: http://localhost:3000)
```

---

## 로컬 실행

```bash
# 의존성 설치
npm install

# DB 스키마 적용
npx drizzle-kit push

# 시드 데이터 삽입 (husband@family.com / wife@family.com)
npm run seed

# 개발 서버 시작
npm run dev
```

`http://localhost:3000` 에서 확인합니다.

---

## 주요 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm run db:push` | DB 스키마 동기화 |
| `npm run db:studio` | Drizzle Studio (DB GUI) |
| `npm run seed` | 시드 데이터 삽입 |

---

## 프로젝트 구조

```
app/
  (auth)/login/       # 로그인 페이지
  (dashboard)/        # 인증 필요 페이지 (레이아웃 공유)
    dashboard/        # 대시보드 홈
    portfolio/        # 포트폴리오 관리
    real-estate/      # 부동산 관리
    budget/           # 가계부
    ai-team/          # AI 에이전트 팀 채팅
    settings/         # 설정
  api/                # API 라우트
lib/
  agents/             # AI 에이전트 (CFO, 투자, 리스크, 부동산, 재무흐름)
  db/                 # Drizzle 설정 및 스키마
  stock-utils.ts      # isDomestic, toNaverCode, getExchangeLabel, getGainColor
  utils.ts            # cn, formatKRW, CACHE_SHORT, CACHE_LONG
components/           # 공유 UI 컴포넌트
types/                # 전역 TypeScript 타입
scripts/seed.ts       # 시드 스크립트
```

---

## 배포

[Vercel](https://vercel.com)에 배포합니다. `vercel.json`에 배포 설정이 포함되어 있습니다.

환경 변수는 Vercel 프로젝트 설정에서 별도로 등록해야 합니다.
