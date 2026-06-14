'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface OrbitalLinkHandlers {
  onFocusSatellite?: (noradId: number) => void
  onFocusConjunction?: (id: string) => void
}

// Convert recognisable orbital references into internal links so the custom
// <a> renderer can intercept them without touching real URLs.
function addOrbitalLinks(md: string, handlers: OrbitalLinkHandlers): string {
  if (handlers.onFocusSatellite) {
    // "NORAD 69105" / "NORAD ID 69105" — anywhere in text
    md = md.replace(/\bNORAD(?:\s+ID)?\s+(\d{4,6})\b/gi, (_, id) =>
      `[NORAD ${id}](orbital://satellite/${id})`,
    )
  }
  if (handlers.onFocusConjunction) {
    // Cuid values in backticks: `cmqd8xyvw0icws2s0b8jz3vvw`
    md = md.replace(/`(c[a-z0-9]{20,})`/g, (_, id) =>
      `[\`${id}\`](orbital://conjunction/${id})`,
    )
  }
  return md
}

export function MarkdownContent({
  content,
  onFocusSatellite,
  onFocusConjunction,
}: { content: string } & OrbitalLinkHandlers) {
  const handlers = { onFocusSatellite, onFocusConjunction }
  const processed = addOrbitalLinks(content, handlers)

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-cyan-300">{children}</strong>
        ),
        em: ({ children }) => <em className="text-slate-300">{children}</em>,
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-0.5 mb-1.5 pl-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-0.5 mb-1.5 pl-1">{children}</ol>
        ),
        li: ({ children }) => <li className="text-slate-200">{children}</li>,
        h1: ({ children }) => (
          <h1 className="text-sm font-bold text-cyan-400 mb-1 mt-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xs font-bold text-cyan-400 mb-1 mt-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-semibold text-slate-300 mb-0.5 mt-1.5 first:mt-0">
            {children}
          </h3>
        ),
        code: ({ children, className }) => {
          const isBlock = !!className?.includes('language-')
          return isBlock ? (
            <code className="block bg-slate-950 text-green-400 text-[10px] p-2 rounded my-1 overflow-x-auto whitespace-pre">
              {children}
            </code>
          ) : (
            <code className="bg-slate-950 text-green-400 text-[10px] px-1 py-0.5 rounded">
              {children}
            </code>
          )
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-cyan-700 pl-2 text-slate-400 italic my-1">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-slate-700 my-2" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded border border-slate-700">
            <table className="w-full text-[10px] border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-slate-700 last:border-0 even:bg-slate-800/30">
            {children}
          </tr>
        ),
        th: ({ children }) => (
          <th className="text-left px-2 py-1 text-cyan-400 font-semibold bg-slate-800/60 border-r border-slate-700 last:border-0">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 text-slate-300 border-r border-slate-700/50 last:border-0">
            {children}
          </td>
        ),
        a: ({ children, href }) => {
          if (href?.startsWith('orbital://satellite/')) {
            const noradId = parseInt(href.replace('orbital://satellite/', ''), 10)
            if (!isNaN(noradId) && onFocusSatellite) {
              return (
                <button
                  onClick={() => onFocusSatellite(noradId)}
                  title="Focus on globe"
                  className="text-cyan-400 underline decoration-dotted hover:text-cyan-200 hover:decoration-solid cursor-pointer transition-colors"
                >
                  {children}
                </button>
              )
            }
          }
          if (href?.startsWith('orbital://conjunction/')) {
            const id = href.replace('orbital://conjunction/', '')
            if (onFocusConjunction) {
              return (
                <button
                  onClick={() => onFocusConjunction(id)}
                  title="Select conjunction"
                  className="text-amber-400 underline decoration-dotted hover:text-amber-200 hover:decoration-solid cursor-pointer transition-colors font-mono text-[10px]"
                >
                  {children}
                </button>
              )
            }
          }
          return (
            <a
              href={href}
              className="text-cyan-400 underline hover:text-cyan-300"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          )
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  )
}
