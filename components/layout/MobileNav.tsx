'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, TrendingUp, Building2, Wallet, Bot } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: '홈', icon: LayoutDashboard },
  { href: '/portfolio', label: '포트폴리오', icon: TrendingUp },
  { href: '/real-estate', label: '부동산', icon: Building2 },
  { href: '/budget', label: '가계부', icon: Wallet },
  { href: '/ai-team', label: 'AI팀', icon: Bot },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-white">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-1 flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
            pathname === href
              ? 'text-blue-600'
              : 'text-gray-400 hover:text-gray-600'
          )}
        >
          <Icon size={20} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
