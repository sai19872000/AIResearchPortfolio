// Aura theme chip — tiny mono pill for tags / categories.
interface ThemeChipProps {
  label: string
}

export function ThemeChip({ label }: ThemeChipProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 'var(--r-pill)',
        border: '1px solid var(--border-strong)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: 'var(--tracking-mono)',
        textTransform: 'uppercase',
        color: 'var(--fg-muted)',
        lineHeight: 'var(--lh-xs)',
        background: 'transparent',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  )
}
