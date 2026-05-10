import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './AskPanel.css'

type AskResponse = {
  sessionId: string
  response: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'

function buildAskUrl(sessionId: string) {
  const query = new URLSearchParams()
  const trimmedSessionId = sessionId.trim()

  if (trimmedSessionId) {
    query.set('sessionId', trimmedSessionId)
  }

  const queryString = query.toString()
  return `${apiBaseUrl}/ask${queryString ? `?${queryString}` : ''}`
}

export function AskPanel() {
  const [question, setQuestion] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [result, setResult] = useState<AskResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const submitDisabled = useMemo(
    () => isSubmitting || question.trim().length === 0,
    [isSubmitting, question],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion) {
      setErrorMessage('Please enter a question before calling the API.')
      return
    }

    setIsSubmitting(true)
    setIsCopied(false)
    setErrorMessage(null)

    try {
      const response = await fetch(buildAskUrl(sessionId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: trimmedQuestion }),
      })

      if (!response.ok) {
        const details = await response.text()
        throw new Error(details || `Request failed with status ${response.status}`)
      }

      const data = (await response.json()) as AskResponse
      setResult(data)
      setSessionId(data.sessionId)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected error while calling Ask endpoint.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClear() {
    setQuestion('')
    setSessionId('')
    setResult(null)
    setIsCopied(false)
    setErrorMessage(null)

    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }

  async function handleCopyResponse() {
    if (!result?.response) {
      return
    }

    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(result.response)
      setIsCopied(true)
      setErrorMessage(null)
      window.setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setErrorMessage('Unable to copy response. Please copy it manually.')
    } finally {
      setIsCopying(false)
    }
  }

  const copyButtonLabel = isCopied ? 'Copied' : isCopying ? 'Copying response' : 'Copy response'

  return (
    <section className="ask-panel" aria-live="polite">
      <header className="ask-panel__header">
        <p className="ask-panel__eyebrow">Ask assistant</p>
      </header>

      <form className="ask-panel__form" onSubmit={handleSubmit}>
        <label htmlFor="question">Question</label>
        <textarea
          id="question"
          ref={textAreaRef}
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={7}
          placeholder="Ask anything. Example: Summarize my app architecture in 5 bullets."
          disabled={isSubmitting}
        />

        <label htmlFor="sessionId">Session ID (optional)</label>
        <input
          id="sessionId"
          name="sessionId"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          placeholder="Will be auto-filled after first response"
          disabled={isSubmitting}
        />

        <div className="ask-panel__actions">
          <button type="submit" disabled={submitDisabled}>
            {isSubmitting ? 'Asking...' : 'Ask'}
          </button>
          <button className="ghost" type="button" onClick={handleClear} disabled={isSubmitting}>
            Clear
          </button>
        </div>
      </form>

      {errorMessage ? (
        <p className="ask-panel__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {result ? (
        <section className="ask-panel__result">
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
      ) : null}
    </section>
  )
}
