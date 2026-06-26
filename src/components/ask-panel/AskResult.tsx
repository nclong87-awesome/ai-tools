import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AskResponse } from './types'

type AskResultProps = {
  result: AskResponse
  onCopyError: (message: string) => void
  onQuickAction: (prompt: string) => void
  quickActionsDisabled: boolean
}

type QuickAction = {
  label: string
  prompt: string
}

function parseQuickActionBlock(rawContent: string): QuickAction | null {
  const lines = rawContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  let label = ''
  let prompt = ''

  for (const line of lines) {
    if (line.toLowerCase().startsWith('label:')) {
      label = line.slice('label:'.length).trim()
      continue
    }

    if (line.toLowerCase().startsWith('prompt:')) {
      prompt = line.slice('prompt:'.length).trim()
    }
  }

  if (!label || !prompt) {
    return null
  }

  return { label, prompt }
}

export function AskResult({
  result,
  onCopyError,
  onQuickAction,
  quickActionsDisabled,
}: AskResultProps) {
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  async function handleCopyResponse() {
    if (!result.response) {
      return
    }

    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(result.response)
      setIsCopied(true)
      window.setTimeout(() => setIsCopied(false), 2000)
    } catch {
      onCopyError('Unable to copy response. Please copy it manually.')
    } finally {
      setIsCopying(false)
    }
  }

  const copyButtonLabel = isCopied ? 'Copied' : isCopying ? 'Copying response' : 'Copy response'

  return (
    <section className="ask-panel__result">
      <p className="ask-panel__meta">Session ID: {result.sessionId}</p>
      <div className="ask-panel__result-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            pre: ({ children, ...props }) => {
              const firstChild = Array.isArray(children) ? children[0] : children
              const childClassName =
                typeof firstChild === 'object' && firstChild && 'props' in firstChild
                  ? (firstChild.props as { className?: string }).className
                  : undefined
              const isQuickAction = childClassName?.includes('language-quick-action')

              if (isQuickAction) {
                return <>{children}</>
              }

              return <pre {...props}>{children}</pre>
            },
            code: ({ className, children, ...props }) => {
              const isQuickAction = className?.includes('language-quick-action')

              if (isQuickAction) {
                const content = Array.isArray(children) ? children.join('') : String(children)
                const quickAction = parseQuickActionBlock(content)

                if (!quickAction) {
                  return null
                }

                return (
                  <button
                    type="button"
                    className="ask-panel__quick-action"
                    onClick={() => onQuickAction(quickAction.prompt)}
                    disabled={quickActionsDisabled}
                  >
                    {quickAction.label}
                  </button>
                )
              }

              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
          }}
        >
          {result.response}
        </ReactMarkdown>
      </div>
      <div className="ask-panel__result-actions">
        <button
          type="button"
          className="ask-panel__copy-button"
          onClick={handleCopyResponse}
          disabled={isCopying}
          aria-label={copyButtonLabel}
          title={copyButtonLabel}
        >
          <span className={`ask-panel__copy-icon${isCopying ? ' is-copying' : ''}`} aria-hidden="true">
            {isCopied ? '✓' : isCopying ? '↻' : '⧉'}
          </span>
        </button>
      </div>
    </section>
  )
}
