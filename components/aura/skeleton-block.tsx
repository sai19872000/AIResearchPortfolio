// Aura skeleton — shimmer placeholder. The brand prefers the breathing ring
// for primary loading states; reach for skeleton for inline list/text loaders.
const shimmerStyle = `
@keyframes aura-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
`

interface SkeletonBlockProps {
  height?: string
  width?: string
  className?: string
}

export function SkeletonBlock({ height = '1rem', width = '100%', className = '' }: SkeletonBlockProps) {
  return (
    <>
      <style>{shimmerStyle}</style>
      <div
        className={className}
        style={{
          height,
          width,
          background:
            'linear-gradient(90deg, var(--surface) 25%, var(--surface-raised) 50%, var(--surface) 75%)',
          backgroundSize: '200% 100%',
          animation: 'aura-shimmer 1.8s ease-in-out infinite',
          borderRadius: 'var(--r-sm)',
        }}
        aria-hidden="true"
      />
    </>
  )
}
