# 가족 AI 자산운용 솔루션 설계 문서

**작성일:** 2026-06-01  
**상태:** 승인됨

---

## 1. 프로젝트 개요

부부가 함께 사용하는 AI 기반 통합 자산운용 플랫폼. 금융자산(주식/ETF/펀드/예금/코인), 부동산, 가계부(수입/지출)를 한 곳에서 관리하며, 전문가 AI 에이전트 팀이 자동으로 모니터링하고 분석을 제공한다.

---

## 2. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | Next.js 14+ App Router |
| UI | shadcn/ui + Tailwind CSS + Recharts |
| AI | Claude API (claude-sonnet-4-6) — tool use |
| DB | PostgreSQL (Neon) + Drizzle ORM |
| 인증 | NextAuth.js v5 |
| 스케줄러 | node-cron (또는 Vercel Cron) |
| 배포 | Vercel |

---

## 3. 사용자

- 부부 2명 (husband / wife 역할 구분)
- 각자 개인 수입/지출 입력 가능
- 자산 데이터는 부부 공유 (전체 합산 뷰)
- NextAuth 이메일+비밀번호 인증

---

## 4. AI 에이전트 팀

### 4.1 CFO 에이전트 (총괄)
- 전체 자산 현황 브리핑 및 다른 에이전트 오케스트레이션
- 주간/월간 종합 리포트 생성
- 사용자 자유 질문 처리 후 전문 에이전트에 위임

### 4.2 투자분석 에이전트
- 포트폴리오 수익률 계산 (종목별/계좌별/전체)
- 자산배분 분석 및 리밸런싱 제안
- 보유 종목 분산 리스크 평가

### 4.3 리스크 매니저 에이전트
- 일별 시장 변동 모니터링
- 특정 종목 집중도 경고 (단일 종목 20% 초과 시)
- 포트폴리오 최대 손실 한도 알림

### 4.4 부동산 에이전트
- 부동산 자산 현재가 추적 및 수익률 계산
- 매입가 대비 평가손익
- 임대수입 관리 및 수익률 분석
- 보유세/양도세 간단 시뮬레이션

### 4.5 재무흐름 에이전트 (가계부)
- 수입 관리: 급여, 상여, 배당, 임대, 기타
- 지출 관리: 고정/변동 지출 카테고리화
- 월별 예산 설정 및 실적 비교
- 순저축률 및 연간 현금흐름 예측

### 4.6 자동화 스케줄

| 주기 | 담당 에이전트 | 내용 |
|------|--------------|------|
| 매일 08:00 | 리스크 매니저 | 전날 시장 변동 체크, 이상 감지 |
| 매주 월요일 | CFO | 주간 포트폴리오 리포트 |
| 매월 1일 | 재무흐름 | 전월 결산 + 다음달 예산 제안 |

---

## 5. 데이터 모델

```sql
-- 사용자
users (
  id, name, email, hashed_password,
  role ENUM('husband','wife'),
  created_at
)

-- 자산 계좌
accounts (
  id, user_id, name,
  type ENUM('stock','fund','deposit','crypto','saving'),
  institution, currency, created_at
)

-- 금융 자산 보유 내역
holdings (
  id, account_id, ticker, name,
  quantity, avg_price, current_price, updated_at
)

-- 거래 내역
transactions (
  id, account_id,
  type ENUM('buy','sell','dividend','deposit','withdraw'),
  ticker, quantity, price, fee, date, memo
)

-- 부동산
real_estate (
  id, user_id, name, address,
  purchase_price, current_value, purchase_date,
  monthly_rental_income, property_tax
)

-- 수입
income (
  id, user_id,
  category ENUM('salary','bonus','dividend','rental','freelance','other'),
  amount, description, date, is_recurring
)

-- 지출
expenses (
  id, user_id,
  category ENUM('food','transport','housing','medical','education','leisure','subscription','other'),
  amount, description, date, is_fixed
)

-- 월별 예산
budgets (
  id, user_id, category, amount, month, year
)

-- AI 리포트
ai_reports (
  id, type ENUM('daily','weekly','monthly','on_demand'),
  agent, content, created_at
)
```

---

## 6. 주요 화면

### 6.1 홈 대시보드 (`/dashboard`)
- 순자산 합계 (금융 + 부동산 - 부채)
- 이번달 수입 / 지출 / 순저축
- 포트폴리오 전체 수익률 (오늘 / 이번달 / 올해)
- AI CFO 한줄 브리핑
- 최근 AI 리포트 목록

### 6.2 포트폴리오 (`/portfolio`)
- 계좌별 자산 목록 및 수익률
- 자산배분 도넛 차트 (국내주식/해외주식/채권/현금/코인)
- 종목별 상세 (매입가, 현재가, 수익률, 비중)
- 투자분석 에이전트 리밸런싱 제안

### 6.3 부동산 (`/real-estate`)
- 부동산 자산 목록
- 현재가 / 매입가 / 평가손익
- 임대수입 현황
- 부동산 에이전트 분석

### 6.4 재무흐름 (`/budget`)
- 월별 수입/지출 바 차트
- 카테고리별 지출 파이 차트
- 예산 vs 실적 비교
- 부부별 수입 내역 + 합산
- 연간 현금흐름 예측

### 6.5 AI 팀 (`/ai-team`)
- CFO에게 자유 질문 (채팅 인터페이스)
- 자동 생성된 리포트 타임라인
- 에이전트별 최신 분석 카드

### 6.6 설정 (`/settings`)
- 계좌/자산 등록 및 관리
- 예산 설정
- 알림 설정
- 프로필

---

## 7. API 구조

```
POST /api/agents/chat          # CFO와 대화
POST /api/agents/report        # 리포트 수동 생성
GET  /api/assets/summary       # 전체 자산 현황
GET  /api/portfolio/holdings   # 보유 종목
POST /api/portfolio/holdings   # 종목 추가
GET  /api/budget/summary       # 가계부 현황
POST /api/income               # 수입 등록
POST /api/expenses             # 지출 등록
POST /api/cron/daily           # 일별 자동 실행
POST /api/cron/weekly          # 주별 자동 실행
POST /api/cron/monthly         # 월별 자동 실행
```

---

## 8. 보안

- NextAuth 세션 기반 인증, 모든 API 라우트에서 세션 검증
- 부부 외 제3자 접근 차단
- Claude API 키는 서버사이드 전용 (환경변수)
- DB 접속 정보 환경변수 관리

---

## 9. 확장 가능성 (v2)

- 텔레그램 알림 연동
- 증권사 API 연동 (자동 시세 갱신)
- 세금 신고 보조 기능
- 자녀 용돈/교육비 관리 추가
