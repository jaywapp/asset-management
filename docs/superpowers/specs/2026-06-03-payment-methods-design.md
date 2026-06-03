# 결제수단(카드/계좌) 관리 기능 설계

**날짜:** 2026-06-03 (업데이트: 2026-06-04)
**범위:** paymentMethods 테이블 신설, expenses/income FK 추가, 탭 필터 UI, 이체 흐름 Sankey, CSV 대화형 가져오기, 이미지 분석 업데이트

---

## 목표

- 지출/수입 항목에 어떤 카드/계좌로 결제됐는지 기록
- 내부 이체(내 계좌 간)와 외부 이체(실질 지출)를 구분
- 허브 계좌 기준 Sankey 다이어그램으로 돈의 흐름 시각화
- 공동 계좌 개념 지원 (부부 공동)
- CSV/이미지 업로드 시 AI 대화형 분류로 불확실 항목 확실하게 정리

---

## 1. 데이터 모델

### 새 enum

```ts
paymentMethodTypeEnum: 'credit_card' | 'debit_card' | 'bank'
ownerEnum: 'husband' | 'wife' | 'joint'
transferTypeEnum: 'internal' | 'external'
// internal: 내 계좌 간 이동 (지출 통계 제외)
// external: 외부 이체 = 실질 지출 (카테고리 선택, 지출 통계 포함)
```

### 새 테이블: `paymentMethods`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | cuid2 |
| userId | text FK | 등록한 사용자 |
| name | text | 표시명 (예: "삼성카드", "토스뱅크(생활비)") |
| type | enum | credit_card / debit_card / bank |
| institution | text | 기관명 (예: "삼성", "토스뱅크") |
| owner | enum | husband / wife / joint |
| isShared | boolean | 공동 여부 |
| isHub | boolean default false | 허브 계좌 여부 (Sankey 기준점, 최대 1개) |
| accountNumber | text nullable | 끝 4자리 (표시용) |
| color | text nullable | UI 구분색 (hex) |
| linkedBankId | text nullable FK | 카드 결제 계좌 → paymentMethods.id |
| createdAt | timestamp | |

> **isHub**: 설정 페이지에서 변경 가능. 변경 시 기존 허브의 isHub를 false로 토글 (DB 트리거 없이 API에서 처리).

### `expenses` 추가 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| paymentMethodId | text nullable FK | 결제수단 |
| transferType | enum nullable | 'internal' \| 'external' (null = 이체 아님) |
| transferToId | text nullable FK | 내부 이체 대상 paymentMethods.id |

> `transferType = 'external'`인 경우: `category`로 지출 분류, 지출 통계에 포함, `transferToId` 불필요.
> `transferType = 'internal'`인 경우: `transferToId` 필수, 지출 통계 제외, Sankey에만 표시.

### `income` 추가 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| paymentMethodId | text nullable FK | 수입 입금 계좌 |

> **하위 호환:** 모든 추가 컬럼은 nullable. 기존 데이터 영향 없음.

### 초기 시드 데이터

| name | type | owner | isHub | linkedBankId |
|------|------|-------|-------|--------------|
| 우리은행 (급여통장) | bank | husband | false | - |
| 카카오뱅크 (부부통장) | bank | joint | **true** | - |
| 하나은행 (용돈통장) | bank | husband | false | - |
| 토스뱅크 (생활비) | bank | joint | false | - |
| 토스뱅크 (광주통장) | bank | joint | false | - |
| 토스뱅크 (영주통장) | bank | joint | false | - |
| 토스뱅크 (이나통장) | bank | joint | false | - |
| 신한은행 (현대카드 결제) | bank | husband | false | - |
| 삼성카드 | credit_card | husband | false | - |
| 현대카드 | credit_card | husband | false | 신한은행 FK |
| 신한카드 | credit_card | wife | false | - |

---

## 2. API 설계

### 신규 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/payment-methods` | 목록 조회 |
| POST | `/api/payment-methods` | 등록 |
| PATCH | `/api/payment-methods/[id]` | 수정 (isHub 변경 포함) |
| DELETE | `/api/payment-methods/[id]` | 삭제 |
| POST | `/api/import/analyze` | CSV/이미지 분석 → 분류 결과 + 불확실 항목 반환 |
| POST | `/api/import/resolve` | 불확실 항목 사용자 답변 제출 → 추가 질문 또는 최종 결과 |
| POST | `/api/import/confirm` | 최종 확인된 항목 DB 저장 |

### 기존 API 변경

**`POST /api/expenses`** — 추가 body 필드:
```ts
{ paymentMethodId?: string, transferType?: 'internal' | 'external', transferToId?: string }
```

**`POST /api/income`** — 추가 body 필드:
```ts
{ paymentMethodId?: string }
```

**`GET /api/expenses`** — 추가 query 파라미터:
```ts
paymentMethodId?: string           // 탭 필터
transferType?: 'internal' | 'external' | 'none'   // 이체 탭
```

**`GET /api/budget/transfers`** (신규) — Sankey 데이터:
```ts
// response
{
  hubAccount: PaymentMethod,
  flows: Array<{
    from: PaymentMethod,
    to: PaymentMethod | string,   // string = 외부 수신자명
    amount: number,
    transferType: 'internal' | 'external',
    category?: string
  }>
}
```

---

## 3. 대화형 가져오기 (AI Conversational Import)

### 처리 흐름

```
1. 업로드 (CSV or 이미지)
      ↓
2. 파서/Vision으로 ParsedEntry[] 추출
      ↓
3. Claude API로 일괄 분류
   → confirmed[]: 신뢰도 높음 (자동 분류)
   → uncertain[]: 불확실 항목 (질문 필요)
      ↓
4. 프론트에 응답:
   { confirmed, uncertain, questions }
      ↓
5. UI: confirmed 목록 표시 + uncertain 항목별 질문 렌더링
      ↓
6. 사용자 답변 제출 → /api/import/resolve
   → 추가 불확실 항목 있으면 반복 (최대 3라운드)
   → 없으면 최종 항목 반환
      ↓
7. 전체 항목 최종 확인 화면
      ↓
8. /api/import/confirm → DB 저장
```

### 불확실 항목 질문 유형

| 상황 | 질문 예시 |
|------|----------|
| 이체인데 내부/외부 불명 | "토스 이체 1,000,000원 — 내 토스(생활비) 계좌로 이동한 건가요, 아니면 외부로 보낸 건가요?" |
| 카드 결제인데 결제수단 불명 | "이 내역의 결제 카드를 선택해주세요: [삼성카드 / 현대카드 / 신한카드]" |
| 카테고리 불명확 | "'올리브영 23,500원' — 카테고리: [의료/약국 / 생활/기타 / 여가]?" |
| 외부 이체인데 카테고리 불명 | "'부모님 50만원' — 카테고리: [경조사 / 기타]?" |

### ParsedEntry 인터페이스 (확장)

```ts
interface ParsedEntry {
  date: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  description: string
  category?: string
  paymentMethodId?: string
  transferType?: 'internal' | 'external'
  transferToId?: string
  confidence: 'high' | 'low'       // high → confirmed, low → uncertain
  question?: string                 // low일 때 AI가 생성한 질문
  options?: string[]                // 선택지 (객관식이면)
}
```

### UI: 대화형 확인 화면

- **Confirmed 섹션**: 자동 분류된 항목 목록. 개별 수정 가능.
- **Uncertain 섹션**: 항목별 카드, AI 질문 + 선택지 버튼 또는 텍스트 입력.
- 답변 후 해당 항목이 Confirmed로 이동.
- 모두 확인 완료 → "전체 저장" 버튼 활성화.

---

## 4. CSV 파서

### 파일 구조

```
lib/csv-parsers/
  index.ts       # detectParser(filename, headers) → parser 선택
  types.ts       # ParsedEntry 인터페이스
  samsung.ts
  hyundai.ts
  shinhan.ts
  woori.ts
  kakao.ts
  hana.ts
  toss.ts
```

### 파서 자동 감지 순서
1. 파일명 패턴 (예: `samsung_*`, `*하나은행*`)
2. CSV 헤더 행 키워드 매칭
3. 감지 실패 시 사용자가 기관 수동 선택

---

## 5. UI 변경사항

### 가계부 페이지 (`/budget`)

- **탭 필터**: `[전체] [삼성카드] [현대카드] [신한카드] [토스(생활비)] ... [이체]`
- **이체 탭**: 내부 이체 목록 + Sankey 다이어그램 (이번 달 기준)
  - Sankey: 허브 계좌 → 내부 이체 (파란/초록 노드) + 외부 이체 (빨간 노드)
  - 허브 계좌 이름 표시, 설정으로 이동 링크
- **지출 입력 폼**: "결제수단" 드롭다운 추가 (3번째 컬럼)
- **내역 목록**: 결제수단 뱃지 + 이체 항목 노란 배경 구분

### 설정 페이지 (`/settings`)

- **결제수단 탭**: 카드/계좌 목록, 추가/수정/삭제, 허브 계좌 지정 버튼
- **가져오기 탭**: 결제수단 선택 + CSV/이미지 업로드 → 대화형 분류 UI

### 이미지 분석 업데이트 (`/api/ai/analyze-image`)

budget 프롬프트 반환 구조에 `paymentMethod` + `confidence` 추가:
```json
{
  "entries": [...],
  "paymentMethod": "삼성카드",
  "confidence": "high"
}
```

---

## 6. CFO 에이전트 업데이트

`get_expense_items` 툴에 `paymentMethodId` 필터 추가:

```ts
paymentMethodId?: string   // 결제수단 ID
transferType?: string      // 'internal' | 'external' | 'none'
```

---

## 7. 구현 순서

1. DB 스키마 + 마이그레이션 (`paymentMethods`, `transferTypeEnum`, `isHub`, `expenses`/`income` 컬럼)
2. `paymentMethods` API (CRUD + isHub 토글)
3. 시드 데이터 업데이트 (11개 결제수단 + 카카오뱅크 isHub: true)
4. `expenses`/`income` API 업데이트
5. Sankey 데이터 API (`GET /api/budget/transfers`)
6. CSV 파서 7개 (`lib/csv-parsers/`)
7. 대화형 가져오기 API (`/api/import/analyze`, `resolve`, `confirm`)
8. 가계부 UI (탭 필터 + 이체 탭 + Sankey)
9. 설정 UI (결제수단 탭 + 가져오기 탭 + 대화형 분류 화면)
10. 이미지 분석 업데이트
11. CFO 툴 업데이트

---

## 8. 범위 외 (이번 구현 제외)

- 계좌 잔액 실시간 추적 (오픈뱅킹 연동)
- 카드사 자동 연동 (마이데이터 라이선스 필요)
- 결제수단별 예산 설정

---

## 9. 카드값 결제 처리 (추가 설계)

### 개념 정리

카드 관련 지출은 두 레이어가 존재하며, 이중계산을 막기 위해 역할을 분리한다.

| 레이어 | 예시 | 처리 방식 |
|--------|------|----------|
| **카드 사용내역** | 마트 50,000원 / 삼성카드 결제 | `expenses` 기록 (`paymentMethodId = 삼성카드`) |
| **카드값 납부** | 신한은행 → 삼성카드 500,000원 | `expenses` + `transferType = internal` + `transferToId = 삼성카드` |

> 카드값 납부는 `internal transfer`로 기록하면 지출 통계에서 자동 제외되고 Sankey에만 표시된다.  
> `linkedBankId`(카드 → 결제 계좌 연결)가 이미 이 흐름을 위해 설계되어 있으므로 스키마 변경 없음.

### UI 동작

- 지출 입력 폼에서 `transferType = internal` + `transferToId = 카드` 선택 시 → "카드값 납부"로 자동 라벨링
- 카드의 `linkedBankId`가 지정돼 있으면 결제 계좌를 자동 추천
- 가계부 지출 합계에서 카드값 납부 항목은 제외 (이미 사용내역으로 계산됨)

### 결제통장 선입금 패턴 (추가)

카드를 사용한 즉시 결제 통장에 같은 금액을 이체하는 패턴을 지원한다.

**흐름:**
```
① 삼성카드로 마트 50,000원  →  expense (지출 통계 포함)
② 허브 → 신한은행(결제통장) 50,000원  →  internal transfer (지출 통계 제외)
③ 월말 신한은행 → 삼성카드 납부  →  internal transfer (지출 통계 제외)
```

**스키마 변경 없음** — ②, ③ 모두 기존 `transferType = internal`로 처리.

**UX: 지출 입력 시 "결제통장 선입금" 옵션**
- 카드(`credit_card` / `debit_card`)로 지출 기록할 때 "결제통장에 바로 이체" 체크박스 표시
- 체크 시: 동일 금액의 `internal transfer` (paymentMethodId = 허브계좌, transferToId = 카드의 `linkedBankId`) 자동 동시 생성
- `linkedBankId`가 없는 카드는 옵션 비표시
- 생성된 이체 항목은 원본 지출과 같은 날짜/메모로 묶여 표시 (`description: "[삼성카드] 마트 선입금"`)

---

## 10. 반복 지출 템플릿 (추가 설계)

### 문제

`isRecurring: true`만으로는 두 케이스를 구분하기 어렵다.

| 유형 | 예시 | 금액 |
|------|------|------|
| **완전 고정 반복** | 넷플릭스, 보험료 | 매달 동일 |
| **변동 반복** | 관리비, 전기요금, 통신비 | 매달 다름 |

### 새 테이블: `recurringTemplates`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | cuid2 |
| userId | text FK | 등록한 사용자 |
| category | expenseCatEnum | 지출 카테고리 |
| description | text | 항목명 (예: "관리비", "넷플릭스") |
| paymentMethodId | text nullable FK | 결제수단 |
| amountType | enum `'fixed' \| 'variable'` | 고정/변동 구분 |
| estimatedAmount | decimal nullable | 변동일 때 참고용 예상 금액 |
| fixedAmount | decimal nullable | 고정일 때 정확한 금액 |
| dayOfMonth | integer nullable | 보통 결제일 (예: 25) |
| isActive | boolean default true | 활성 여부 |
| createdAt | timestamp | |

> `amountType = 'fixed'`이면 `fixedAmount` 필수, 매달 자동 생성.  
> `amountType = 'variable'`이면 `estimatedAmount`는 참고용, 매달 실제 금액 직접 입력.

### `expenses` 추가 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| recurringTemplateId | text nullable FK | 반복 템플릿 참조 |

### 신규 enum

```ts
recurringAmountTypeEnum: 'fixed' | 'variable'
```

### 월별 처리 흐름

```
매달 1일 (cron):
  → recurringTemplates 조회 (isActive: true)
  → amountType = 'fixed': expenses 자동 생성 (fixedAmount 그대로)
  → amountType = 'variable': expenses 자동 생성 (amount = 0, "미입력" 상태)
```

### UI

- **설정 → 반복 지출 탭**: 템플릿 목록, 추가/수정/삭제, 활성화 토글
- **가계부 페이지 상단 배너**: "이번 달 미입력 반복 지출: [관리비, 전기요금] — 금액 입력하기"
  - `recurringTemplateId`가 있고 `amount = 0`인 항목 감지
- **지출 입력 시**: 반복 템플릿 선택 드롭다운 → 선택하면 category/paymentMethodId 자동 채움

### API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/recurring-templates` | 목록 조회 |
| POST | `/api/recurring-templates` | 등록 |
| PATCH | `/api/recurring-templates/[id]` | 수정 |
| DELETE | `/api/recurring-templates/[id]` | 삭제 |
| POST | `/api/cron/monthly` | 기존 크론에 자동 생성 로직 추가 |

### CFO 에이전트 연동

- "이번 달 관리비 아직 안 입력됐어요" 같은 능동 알림 가능
- `get_expense_items`에 `recurringTemplateId` 필터 추가
