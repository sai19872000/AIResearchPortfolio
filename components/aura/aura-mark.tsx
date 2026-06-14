// Aura mark — the breathing ring. The single canonical brand visual.
//
// Three concentric circles, the innermost breathing on a 4s sine.
// Use this as splash, footer, or one status indicator. NEVER as decoration.
//
// The brand has no spinner — loading is the breathing ring.
interface AuraMarkProps {
  size?: number
  color?: string
  /** 'breathing' (default) | 'still' (for reduced-motion contexts) */
  state?: 'breathing' | 'still'
  className?: string
}

export function AuraMark({
  size = 24,
  color = 'var(--accent)',
  state = 'breathing',
  className = '',
}: AuraMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="saiteja.ai"
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth=".4" opacity=".4" />
      <circle cx="12" cy="12" r="6"  stroke={color} strokeWidth=".4" opacity=".7" />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill={color}
        style={{
          transformOrigin: 'center',
          animation: state === 'breathing' ? 'aura-breathe 4s ease-in-out infinite' : 'none',
          opacity: state === 'still' ? 0.85 : undefined,
        }}
      />
    </svg>
  )
}
