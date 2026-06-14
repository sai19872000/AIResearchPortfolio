'use client'
// Aura status badge — pill mapping status strings to color + breath.
// Default statuses: live, building, ready, idle, failed.
// Extend CONFIG to add new statuses. Unknown statuses render as "Unknown".
type Status = string

interface StatusBadgeProps {
  status: Status
}

type BadgeConfig = { label: string; color: string; bg: string; pulse: boolean }

const CONFIG: Record<string, BadgeConfig> = {
  live: {
    label: 'live',
    color: 'var(--accent)',
    bg: 'rgba(138, 182, 255, 0.08)',
    pulse: true,
  },
  building: {
    label: 'building…',
    color: 'var(--accent)',
    bg: 'rgba(138, 182, 255, 0.08)',
    pulse: true,
  },
  ready: {
    label: 'ready',
    color: 'var(--ok)',
    bg: 'rgba(138, 182, 255, 0.08)',
    pulse: false,
  },
  idle: {
    label: 'idle',
    color: 'var(--fg-muted)',
    bg: 'rgba(255, 255, 255, 0.04)',
    pulse: false,
  },
  reviewing: {
    label: 'reviewing',
    color: 'var(--accent-warm)',
    bg: 'rgba(255, 179, 71, 0.08)',
    pulse: true,
  },
  failed: {
    label: 'failed',
    color: 'var(--danger)',
    bg: 'rgba(255, 107, 107, 0.08)',
    pulse: false,
  },
}

const FALLBACK: BadgeConfig = {
  label: 'unknown',
  color: 'var(--fg-muted)',
  bg: 'rgba(255, 255, 255, 0.04)',
  pulse: false,
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? FALLBACK
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        padding: '4px 12px',
        borderRadius: 'var(--r-pill)',
        fontSize: 'var(--text-xs)',
        lineHeight: 'var(--lh-xs)',
        letterSpacing: 'var(--tracking-mono)',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.bg}`,
        transition: `color var(--duration-slow) var(--ease-standard),
                     background var(--duration-slow) var(--ease-standard)`,
      }}
    >
      {cfg.pulse && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: cfg.color,
            display: 'inline-block',
            animation: 'pulse-dot 1.4s ease-in-out infinite',
          }}
        />
      )}
      {cfg.label}
    </span>
  )
}