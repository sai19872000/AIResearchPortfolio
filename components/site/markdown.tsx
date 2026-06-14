import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders post markdown with the Aura prose styles (app/globals.css .prose).
 * GFM tables/strikethrough/task-lists supported. Raw HTML is intentionally
 * NOT enabled — content is trusted-author markdown, and skipping rehype-raw
 * keeps the server bundle lean and avoids HTML-injection surface.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
