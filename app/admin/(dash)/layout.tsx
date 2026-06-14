import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAuthed } from '@/lib/auth'
import { Mark } from '@/components/auracle/mark'
import { LogoutButton } from '@/components/admin/logout-button'

export const dynamic = 'force-dynamic'

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect('/admin/login')
  return (
    <div className="min-h-screen">
      <header style={{ borderBottom: '1px solid var(--line)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(8px)' }}
        className="sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
            <Mark size={24} />
            <span className="t-label">Blog admin</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="t-label" style={{ textTransform: 'none', letterSpacing: '.02em', color: 'var(--text-muted)' }}>View site →</Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-12">{children}</div>
    </div>
  )
}
