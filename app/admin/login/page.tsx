import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAuthed } from '@/lib/auth'
import { LoginForm } from '@/components/admin/login-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Admin', robots: { index: false } }

export default async function AdminLogin() {
  if (await isAuthed()) redirect('/admin')
  return <LoginForm />
}
