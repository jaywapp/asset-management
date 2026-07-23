'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, TrendingUp, Building2,
  Wallet, Bot, Settings, LogOut, CreditCard, MessageSquareWarning
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/portfolio', label: '포트폴리오', icon: TrendingUp },
  { href: '/real-estate', label: '부동산', icon: Building2 },
  { href: '/budget', label: '재무흐름', icon: Wallet },
  { href: '/accounts', label: '계좌·카드', icon: CreditCard },
  { href: '/ai-team', label: 'AI 팀', icon: Bot },
  { href: '/settings', label: '설정', icon: Settings },
  { href: '/feedback', label: '제보', icon: MessageSquareWarning },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r bg-white h-screen flex-col">
      <div className="px-6 py-5 border-b">
        <h1 className="font-bold text-lg text-gray-900">이나네 가족자산</h1>
        <p className="text-xs text-gray-400 mt-0.5">AI 에이전트 팀</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              pathname === href
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Icon size={18} className="shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
