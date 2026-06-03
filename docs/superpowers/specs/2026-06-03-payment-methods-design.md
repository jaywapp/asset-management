# 결제수단(카드/계좌) 관리 기능 설계

**날짜:** 2026-06-03  
**범위:** paymentMethods 테이블 신설, expenses/income FK 추가, 탭 필터 UI, CSV 가져오기, 이미지 분석 업데이트

---

## 목표

- 지출/수입 항목에 어떤 카드/계좌로 결제됐는지 기록
- 계좌간 이체를 실제 지출과 구분
- 공동 계좌 개념 지원 (부부 공동)
- 카드사/은행 CSV 일괄 가져오기로 수동 입력 최소화

---

## 1. 데이터 모델

### 새 enum

```ts
paymentMethodTypeEnum: 'credit_card' | 'debit_card' | 'bank'
ownerEnum: 'husband' | 'wife' | 'joint'
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
| accountNumber | text nullable | 끝 4자리 (표시용) |
| color | text nullable | UI 구분색 (hex) |
| linkedBankId | text nullable FK | 카드 결제 계좌 → paymentMethods.id |
| createdAt | timestamp | |

### `expenses` 추가 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| paymentMethodId | text nullable FK | 결제수단 |
| isTransfer | boolean default false | 계좌간 이체 여부 |
| transferToId | text nullable FK | 이체 대상 paymentMethods.id |

### `income` 추가 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| paymentMethodId | text nullable FK | 수입 입금 계좌 |

> **하위 호환:** 모든 추가 컬럼은 nullable. 기존 데이터 영향 없음.

### 초기 시드 데이터

| name | type | owner | linkedBankId |
|------|------|-------|--------------|
| 우리은행 (급여통장) | bank | husband | - |
| 카카오뱅크 (부부통장) | bank | joint | - |
| 하나은행 (용돈통장) | bank | husband | - |
| 토스뱅크 (생활비) | bank | joint | - |
| 토스뱅크 (광주통장) | bank | joint | - |
| 토스뱅크 (영주통장) | bank | joint | - |
| 토스뱅크 (이나통장) | bank | joint | - |
| 신한은행 (현대카드 결제) | bank | husband | - |
| 삼성카드 | credit_card | husband | - |
| 현대카드 | credit_card | husband | 신한은행 FK |
| 신한카드 | credit_card | wife | - |

---

## 2. API 설계

### 신규 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/payment-methods` | 목록 조회 |
| POST | `/api/payment-methods` | 등록 |
| PATCH | `/api/payment-methods/[id]` | 수정 |
| DELETE | `/api/payment-methods/[id]` | 삭제 |
| POST | `/api/payment-methods/[id]/import-csv` | CSV 가져오기 |

### 기존 API 변경

**`POST /api/expenses`** — 추가 body 필드:
```ts
{ paymentMethodId?: string, isTransfer?: boolean, transferToId?: string }
```

**`POST /api/income`** — 추가 body 필드:
```ts
{ paymentMethodId?: string }
```

**`GET /api/expenses`** — 추가 query 파라미터:
```ts
paymentMethodId?: string   // 탭 필터
isTransfer?: boolean       // 이체만 조회
```

---

## 3. CSV 파서

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

### ParsedEntry 인터페이스

```ts
interface ParsedEntry {
  date: string              // YYYY-MM-DD
  amount: number            // 양수
  type: 'income' | 'expense' | 'transfer'
  description: string
  category?: ExpenseCategory | IncomeCategory
}
```

### 파서 자동 감지 순서
1. 파일명 패턴 (예: `samsung_*`, `*하나은행*`)
2. CSV 헤더 행 키워드 매칭
3. 감지 실패 시 사용자가 기관 수동 선택

### import-csv 처리 흐름
1. CSV 업로드 → multipart/form-data
2. 기관 파서로 ParsedEntry[] 변환
3. Claude API로 카테고리 미분류 항목 일괄 분류 (배치)
4. 미리보기 응답 반환 (항목별 확인 가능)
5. 사용자 확인 후 DB 저장

---

## 4. UI 변경사항

### 가계부 페이지 (`/budget`)

- 탭 필터 추가: `[전체] [삼성카드] [현대카드] [신한카드] [토스(생활비)] ... [이체]`
- 지출 입력 폼에 "결제수단 선택" 드롭다운 추가 (3번째 컬럼, 기존 2행 레이아웃 유지)
- 내역 목록에 결제수단 뱃지 표시 (institution 기반 색상)
- 이체 항목은 노란 배경으로 구분

### 설정 페이지 (`/settings`)

- "결제수단" 탭 추가
- 카드/계좌 목록 (이름, 타입, 소유자, 수정/삭제)
- 결제수단 추가 폼 (이름, 타입, 기관, 소유자, 색상)
- "CSV 가져오기" 탭 추가
  - 결제수단 선택 드롭다운
  - 파일 업로드 → 미리보기 테이블 → 확인 후 저장

### 이미지 분석 업데이트 (`/api/ai/analyze-image`)

budget 프롬프트 반환 구조에 `paymentMethod` 추가:
```json
{
  "entries": [...],
  "paymentMethod": "삼성카드"
}
```
프론트에서 반환된 `paymentMethod`로 드롭다운 자동 선택.

---

## 5. CFO 에이전트 업데이트

`get_expense_items` 툴에 `paymentMethodId` 필터 파라미터 추가:

```ts
{
  name: 'get_expense_items',
  input_schema: {
    properties: {
      year: { type: 'number' },
      month: { type: 'number' },
      paymentMethodId: { type: 'string', description: '결제수단 ID (선택)' },
      fixedOnly: { type: 'boolean' },
      category: { type: 'string' }
    }
  }
}
```

---

## 6. 구현 순서

1. DB 스키마 + 마이그레이션
2. `paymentMethods` API (CRUD)
3. 시드 데이터 업데이트
4. expenses/income API 업데이트
5. CSV 파서 (`lib/csv-parsers/`)
6. import-csv API
7. 가계부 UI (탭 필터 + 폼 드롭다운)
8. 설정 UI (결제수단 탭 + CSV 가져오기 탭)
9. 이미지 분석 업데이트
10. CFO 툴 업데이트

---

## 7. 범위 외 (이번 구현 제외)

- 계좌 잔액 실시간 추적 (오픈뱅킹 연동)
- 카드사 자동 연동 (마이데이터 라이선스 필요)
- 결제수단별 예산 설정
