import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AskResponse } from './types'

type AskResultProps = {
  result: AskResponse
  onCopyError: (message: string) => void
}

export function AskResult({ result, onCopyError }: AskResultProps) {
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
