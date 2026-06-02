'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const completedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startProgress() {
    completedRef.current = false
    setVisible(true)
    setWidth(15)
    // 천천히 90%까지 증가
    intervalRef.current = setInterval(() => {
      setWidth(w => {
        if (w >= 90) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 90
        }
        return w + (90 - w) * 0.08
      })
    }, 100)
  }

  function completeProgress() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    completedRef.current = true
    setWidth(100)
    setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 300)
  }

  // 내부 링크 클릭 감지 → 시작
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      // 외부 링크, 해시, 특수 링크 제외
      if (href.startsWith('http') || href.startsWith('#') ||
          href.startsWith('mailto') || href.startsWith('tel')) return
      // 현재 페이지와 같으면 스킵
      if (href === pathname) return
      startProgress()
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pathname])

  // pathname 변경 → 완료
  useEffect(() => {
    if (visible) completeProgress()
  }, [pathname])

  if (!visible && width === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] h-[2px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms' }}
    >
      <div
        className="h-full bg-blue-500"
        style={{
          width: `${width}%`,
          transition: width === 100 ? 'width 150ms ease-out' : 'width 80ms ease-in',
          boxShadow: '0 0 8px rgba(59,130,246,0.6)',
        }}
      />
    </div>
  )
}
