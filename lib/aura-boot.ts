let printed = false

export function printAuraSignature() {
  if (typeof window === 'undefined' || printed) return
  printed = true
  console.log(
    '%c◐ quietly forged at saiteja.ai',
    'color:#8AB6FF;font-family:monospace;letter-spacing:.15em',
  )
}
