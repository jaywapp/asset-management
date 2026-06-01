import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '이나네 가족자산',
  description: 'AI 에이전트 팀과 함께하는 가족 통합 자산운용 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className={`${geist.className} h-full antialiased`}>{children}</body>
    </html>
  )
}
