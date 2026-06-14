export function formatDate(iso: string | null, opts: { month?: 'short' | 'long' } = {}): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: opts.month || 'short',
    day: 'numeric',
  })
}

export function yearMonth(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}
