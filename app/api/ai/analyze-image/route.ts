import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPTS = {
  budget: `이 이미지는 은행 거래내역, 카드 사용내역, 영수증, 또는 출금내역입니다.
이미지에서 거래 내역을 추출하여 다음 JSON 형식으로 반환하세요. 반드시 JSON만 반환하고 다른 텍스트는 포함하지 마세요.

{
  "entries": [
    {
      "type": "income" 또는 "expense",
      "amount": 숫자 (원화 기준),
      "description": "거래 설명",
      "category": "salary|bonus|dividend|rental|freelance|other|food|transport|housing|medical|education|leisure|subscription",
      "date": "YYYY-MM-DD"
    }
  ]
}

카테고리 선택 기준:
- 급여/월급 → salary, 상여 → bonus, 배당 → dividend, 임대 → rental
- 식당/카페/마트 → food, 교통/주유 → transport, 월세/관리비 → housing
- 병원/약국 → medical, 학원/도서 → education, 영화/여가 → leisure
- 정기결제/구독 → subscription, 나머지 수입 → other(income), 나머지 지출 → other(expense)

날짜가 없으면 오늘 날짜(${new Date().toISOString().split('T')[0]})를 사용하세요.`,

  portfolio: `이 이미지는 주식 보유 내역, 증권 계좌 화면, 또는 포트폴리오 스크린샷입니다.
이미지에서 보유 종목 정보를 추출하여 다음 JSON 형식으로 반환하세요. 반드시 JSON만 반환하고 다른 텍스트는 포함하지 마세요.

{
  "entries": [
    {
      "ticker": "종목코드 (예: 005930, AAPL)",
      "name": "종목명",
      "quantity": 보유수량(숫자),
      "avgPrice": 평균단가(숫자, 원화),
      "currentPrice": 현재가(숫자, 원화)
    }
  ]
}

종목코드를 확인할 수 없으면 종목명으로 대체하세요. 수량이나 가격이 불명확하면 0으로 설정하세요.`,
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { imageBase64, mediaType, context } = await req.json()

  if (!imageBase64 || !context || !PROMPTS[context as keyof typeof PROMPTS]) {
    return NextResponse.json({ error: 'imageBase64, mediaType, context required' }, { status: 400 })
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: (mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: PROMPTS[context as keyof typeof PROMPTS],
          },
        ],
      },
    ],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: '이미지에서 데이터를 추출할 수 없습니다.', raw: text }, { status: 422 })
  }
}
