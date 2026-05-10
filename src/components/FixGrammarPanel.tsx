import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './FixGrammarPanel.css'

type FixGrammarResponse = {
  sessionId: string
  response: string
}

const apiBaseUrl = 'http://localhost:8888'


function buildFixGrammarUrl(sessionId: string) {
  const query = new URLSearchParams()
  const trimmedSessionId = sessionId.trim()
  if (trimmedSessionId) {
    query.set('sessionId', trimmedSessionId)
  }

  const queryString = query.toString()
  return `${apiBaseUrl}/grammar${queryString ? `?${queryString}` : ''}`
}

export function FixGrammarPanel() {
  const [text, setText] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [result, setResult] = useState<FixGrammarResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const submitDisabled = useMemo(
    () => isSubmitting || text.trim().length === 0,
    [isSubmitting, text],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedText = text.trim()
    if (!trimmedText) {
      setErrorMessage('Please enter text before calling the API.')
      return
    }

    setIsSubmitting(true)
    setIsCopied(false)
    setErrorMessage(null)

    try {
      const response = await fetch(buildFixGrammarUrl(sessionId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmedText }),
      })

      if (!response.ok) {
        const details = await response.text()
        throw new Error(details || `Request failed with status ${response.status}`)
      }

      const data = (await response.json()) as FixGrammarResponse
      setResult(data)
      setSessionId(data.sessionId)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unexpected error while calling FixGrammar endpoint.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClear() {
    setText('')
    setSessionId('')
    setResult(null)
    setIsCopied(false)
    setErrorMessage(null)
    if (textAreaRef.current) {
      textAreaRef.current.focus();
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

  const copyButtonLabel = isCopied
    ? 'Copied'
    : isCopying
      ? 'Copying response'
      : 'Copy response'

  return (
    <section className="fix-grammar-panel" aria-live="polite">
      <header className="fix-grammar-panel__header">
        <p className="fix-grammar-panel__eyebrow">Agent Framework</p>
        <h1>Fix grammar</h1>
        <p>
          Submit text to <strong>/grammar</strong> and reuse the returned session for
          follow-up edits.
        </p>
      </header>

      <form className="fix-grammar-panel__form" onSubmit={handleSubmit}>
        <label htmlFor="text">Text to correct</label>
        <textarea
          id="text"
          ref={textAreaRef}
          name="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={7}
          placeholder="I has wrote this sentence with some grammar issue."
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

        <div className="fix-grammar-panel__actions">
          <button type="submit" disabled={submitDisabled}>
            {isSubmitting ? 'Fixing...' : 'Fix Grammar'}
          </button>
          <button
            className="ghost"
            type="button"
            onClick={handleClear}
            disabled={isSubmitting}
          >
            Clear
          </button>
        </div>
      </form>

      {errorMessage ? (
        <p className="fix-grammar-panel__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {result ? (
        <section className="fix-grammar-panel__result">
          <p className="fix-grammar-panel__result-text">{result.response}</p>
          <div className="fix-grammar-panel__result-actions">
            <button
              type="button"
              className="fix-grammar-panel__copy-button"
              onClick={handleCopyResponse}
              disabled={isCopying}
              aria-label={copyButtonLabel}
              title={copyButtonLabel}
            >
              <span
                className={`fix-grammar-panel__copy-icon${isCopying ? ' is-copying' : ''}`}
                aria-hidden="true"
              >
                {isCopied ? '✓' : isCopying ? '↻' : '⧉'}
              </span>
            </button>
          </div>
        </section>
      ) : null}
    </section>
  )
}