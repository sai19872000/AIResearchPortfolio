'use client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  return (
    <button
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' })
        router.replace('/admin/login')
        router.refresh()
      }}
      className="t-label"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: '.02em' }}
    >
      Sign out
    </button>
  )
}
