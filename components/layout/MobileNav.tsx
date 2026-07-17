'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, TrendingUp, Building2, Wallet, Bot, CreditCard, Settings, MoreHorizontal, X } from 'lucide-react'

const mainItems = [
  { href: '/dashboard', label: '홈', icon: LayoutDashboard },
  { href: '/portfolio', label: '포트폴리오', icon: TrendingUp },
  { href: '/budget', label: '가계부', icon: Wallet },
  { href: '/accounts', label: '계좌·카드', icon: CreditCard },
]

const moreItems = [
  { href: '/real-estate', label: '부동산', icon: Building2 },
  { href: '/ai-team', label: 'AI팀', icon: Bot },
  { href: '/settings', label: '설정', icon: Settings },
]

const allItems = [...mainItems, ...moreItems]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isMoreActive = moreItems.some(i => i.href === pathname)

  return (
    <>
      {/* 더보기 드로어 */}
      {open && (
        <>
          <button
            type="button"
            aria-label="전체 메뉴 닫기"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t rounded-t-2xl shadow-lg px-4 pt-4 pb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">전체 메뉴</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="전체 메뉴 닫기" className="text-gray-400 hover:text-gray-600">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {allItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-colors',
                    pathname === href
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-500 hover:bg-gray-50'
                  )}
                >
                  <Icon size={22} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 하단 탭바 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-white" aria-label="모바일 주요 메뉴">
        {mainItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
              pathname === href ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          type="button"
          aria-expanded={open}
          aria-label="전체 메뉴"
          onClick={() => setOpen(v => !v)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
            isMoreActive || open ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
          )}
        >
          <MoreHorizontal size={20} />
          <span>더보기</span>
        </button>
      </nav>
    </>
  )
}
