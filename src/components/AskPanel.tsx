import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './AskPanel.css'

type AskResponse = {
  sessionId: string
  response: string
}

type FeatureId = 'web-search' | 'fix-sentence'

type FeatureOption = {
  id: FeatureId
  name: string
  description: string
  transformPrompt: (value: string) => string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'
const defaultFeatureId: FeatureId = 'web-search'
const lastUsedFeatureStorageKey = 'ask-panel:last-used-feature'

const featureOptions: FeatureOption[] = [
  {
    id: 'fix-sentence',
    name: 'Fix sentence',
    description: 'Rewrite grammar and wording for a single sentence.',
    transformPrompt: (value) => `Fix this sentence: ${value}`,
  },
  {
    id: 'web-search',
    name: 'Web search',
    description: 'Ask with web context when the agent needs fresh information.',
    transformPrompt: (value) => value,
  },
]

function isFeatureId(value: string | null): value is FeatureId {
  return value === 'web-search' || value === 'fix-sentence'
}

function readLastUsedFeature(): FeatureId | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storedFeature = window.localStorage.getItem(lastUsedFeatureStorageKey)
  return isFeatureId(storedFeature) ? storedFeature : null
}

function getFeatureById(featureId: FeatureId): FeatureOption {
  return featureOptions.find((feature) => feature.id === featureId) ?? featureOptions[0]
}

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
  const [promptInput, setPromptInput] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [result, setResult] = useState<AskResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [selectedFeatureId, setSelectedFeatureId] = useState<FeatureId>(
    () => readLastUsedFeature() ?? defaultFeatureId,
  )
  const [lastUsedFeatureId, setLastUsedFeatureId] = useState<FeatureId | null>(
    () => readLastUsedFeature(),
  )
  const [isFeatureMenuOpen, setIsFeatureMenuOpen] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }, [])

  const selectedFeature = useMemo(
    () => getFeatureById(selectedFeatureId),
    [selectedFeatureId],
  )

  const lastUsedFeatureName = useMemo(() => {
    return lastUsedFeatureId ? getFeatureById(lastUsedFeatureId).name : 'None yet'
  }, [lastUsedFeatureId])

  const submitDisabled = useMemo(
    () => isSubmitting || promptInput.trim().length === 0,
    [isSubmitting, promptInput],
  )

  const inputLabel = selectedFeatureId === 'fix-sentence' ? 'Sentence' : 'Prompt'
  const inputPlaceholder =
    selectedFeatureId === 'fix-sentence'
      ? 'I has wrote this sentence with some grammar issue.'
      : 'Ask anything. Example: Find the latest release notes for .NET.'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPromptInput = promptInput.trim()

    if (!trimmedPromptInput) {
      setErrorMessage('Please enter text before calling the API.')
      return
    }

    const outboundPrompt = selectedFeature.transformPrompt(trimmedPromptInput)

    setIsSubmitting(true)
    setIsCopied(false)
    setErrorMessage(null)

    try {
      const response = await fetch(buildAskUrl(sessionId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: outboundPrompt }),
      })

      if (!response.ok) {
        const details = await response.text()
        throw new Error(details || `Request failed with status ${response.status}`)
      }

      const data = (await response.json()) as AskResponse
      setResult(data)
      setSessionId(data.sessionId)
      setLastUsedFeatureId(selectedFeatureId)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(lastUsedFeatureStorageKey, selectedFeatureId)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected error while calling Ask endpoint.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSelectFeature(featureId: FeatureId) {
    setSelectedFeatureId(featureId)
    setLastUsedFeatureId(featureId)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(lastUsedFeatureStorageKey, featureId)
    }

    setIsFeatureMenuOpen(false)
    setErrorMessage(null)
  }

  function handleClear() {
    setPromptInput('')
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

        <div className="ask-panel__feature-area">
        <div className="ask-panel__feature-row">
          <button
            type="button"
            className="ask-panel__feature-trigger"
            onClick={() => setIsFeatureMenuOpen((open) => !open)}
            aria-expanded={isFeatureMenuOpen}
            aria-controls="feature-menu"
          >
            + Add feature
          </button>
          <p className="ask-panel__feature-current">
            Using <strong>{selectedFeature.name}</strong>
          </p>
        </div>

        {isFeatureMenuOpen ? (
          <ul id="feature-menu" className="ask-panel__feature-menu" aria-label="Available features">
            {featureOptions.map((feature) => (
              <li key={feature.id}>
                <button
                  type="button"
                  className={`ask-panel__feature-option${selectedFeatureId === feature.id ? ' is-selected' : ''}`}
                  onClick={() => handleSelectFeature(feature.id)}
                >
                  <span className="ask-panel__feature-name">{feature.name}</span>
                  <span className="ask-panel__feature-description">{feature.description}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="ask-panel__last-used">Last used feature: {lastUsedFeatureName}</p>
      </div>

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

      {result ? (
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
      ) : null}
    </section>
  )
}
