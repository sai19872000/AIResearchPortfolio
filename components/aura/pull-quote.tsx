// Aura pull quote — display italic 200, accent left rule.
interface PullQuoteProps {
  text: string
}

export function PullQuote({ text }: PullQuoteProps) {
  return (
    <blockquote
      style={{
        borderLeft: '2px solid var(--accent)',
        paddingLeft: 'var(--sp-6)',
        margin: 'var(--sp-8) 0',
        fontStyle: 'italic',
        fontWeight: 200,
        color: 'var(--fg)',
        fontFamily: 'var(--font-primary)',
        fontSize: 'var(--text-h3)',
        lineHeight: 1.5,
        letterSpacing: 'var(--tracking-display)',
      }}
    >
      {text}
    </blockquote>
  )
}
