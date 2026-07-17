import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '이나네 가족자산',
  description: 'AI 에이전트 팀과 함께하는 가족 통합 자산운용 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full font-sans antialiased">{children}</body>
    </html>
  )
}
