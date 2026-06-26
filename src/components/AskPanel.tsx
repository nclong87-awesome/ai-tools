import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AskResult } from './ask-panel/AskResult'
import { ToolSelector } from './ask-panel/ToolSelector'
import type { AskResponse } from './ask-panel/types'
import './AskPanel.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'

function buildPromptWithSelectedTools(input: string, selectedToolIds: string[]): string {
  if (selectedToolIds.length === 0) {
    return input
  }

  return `Use tools: ${selectedToolIds.join(', ')}\n\n${input}`
}

export function AskPanel() {
  const [promptInput, setPromptInput] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [result, setResult] = useState<AskResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }, [])

  const submitDisabled = useMemo(
    () => isSubmitting || promptInput.trim().length === 0,
    [isSubmitting, promptInput],
  )

  const inputLabel = 'Prompt'
  const inputPlaceholder = 'Enter your question or request here...'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPromptInput = promptInput.trim()

    if (!trimmedPromptInput) {
      setErrorMessage('Please enter text before calling the API.')
      return
    }

    const outboundPrompt = buildPromptWithSelectedTools(trimmedPromptInput, selectedToolIds)

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: outboundPrompt, sessionId }),
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
    setPromptInput('')
    setSessionId('')
    setResult(null)
    setErrorMessage(null)

    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }

  return (
    <section className="ask-panel" aria-live="polite">
      <header className="ask-panel__header">
        <p className="ask-panel__eyebrow">Assistant tools</p>
      </header>
      <form className="ask-panel__form" onSubmit={handleSubmit}>
        <label htmlFor="promptInput">{inputLabel}</label>
        <textarea
          id="promptInput"
          ref={textAreaRef}
          name="promptInput"
          value={promptInput}
          onChange={(event) => setPromptInput(event.target.value)}
          rows={7}
          placeholder={inputPlaceholder}
          disabled={isSubmitting}
        />

        <ToolSelector disabled={isSubmitting} onSelectionChange={setSelectedToolIds} />

        <div className="ask-panel__actions">
          <button type="submit" disabled={submitDisabled}>
            {isSubmitting ? 'Sending...' : 'Send'}
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

      {result ? <AskResult result={result} onCopyError={setErrorMessage} /> : null}
    </section>
  )
}
