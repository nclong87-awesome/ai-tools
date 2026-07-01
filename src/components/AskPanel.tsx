import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'
import { AskResult } from './ask-panel/AskResult'
import { FormToolFields } from './ask-panel/FormToolFields'
import { ToolSelector } from './ask-panel/ToolSelector'
import { buildStructuredPrompt, validateFormValues } from './ask-panel/formAwareTools'
import type { AskRequestPayload, AskResponse, ToolOption, ToolSelectionChange } from './ask-panel/types'
import './AskPanel.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'
const providerStorageKey = 'askPanel.selectedProvider'

function readStoredProvider(): string {
  try {
    const value = window.localStorage.getItem(providerStorageKey)
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

function writeStoredProvider(provider: string): void {
  try {
    const trimmedProvider = provider.trim()

    if (!trimmedProvider) {
      window.localStorage.removeItem(providerStorageKey)
      return
    }

    window.localStorage.setItem(providerStorageKey, trimmedProvider)
  } catch {
    // Ignore storage write failures and continue using in-memory state.
  }
}

export function AskPanel() {
  const [promptInput, setPromptInput] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [providers, setProviders] = useState<string[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false)
  const [result, setResult] = useState<AskResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTools, setSelectedTools] = useState<ToolOption[]>([])
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function loadProviders() {
      setIsLoadingProviders(true)
      const storedProvider = readStoredProvider()

      try {
        const response = await fetch(`${apiBaseUrl}/providers`)

        if (!response.ok) {
          const details = await response.text()
          throw new Error(details || `Request failed with status ${response.status}`)
        }

        const data = (await response.json()) as { providers?: unknown }
        const nextProviders = Array.isArray(data.providers)
          ? data.providers.filter((provider): provider is string => typeof provider === 'string')
          : []

        if (isCancelled) {
          return
        }

        setProviders(nextProviders)
        setSelectedProvider((currentSelection) => {
          if (nextProviders.length === 0) {
            return ''
          }

          if (storedProvider && nextProviders.includes(storedProvider)) {
            return storedProvider
          }

          if (currentSelection && nextProviders.includes(currentSelection)) {
            return currentSelection
          }

          return nextProviders[0]
        })
      } catch (error) {
        if (isCancelled) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Unexpected error while loading providers.'
        setErrorMessage(message)
        setProviders([])
        setSelectedProvider('')
      } finally {
        if (!isCancelled) {
          setIsLoadingProviders(false)
        }
      }
    }

    void loadProviders()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    writeStoredProvider(selectedProvider)
  }, [selectedProvider])

  const activeFormTool = useMemo(() => {
    if (selectedTools.length === 0) {
      return null
    }

    const formTools = selectedTools.filter((tool) => tool.requiresUserForm)
    return formTools.length > 0 ? formTools[formTools.length - 1] : null
  }, [selectedTools])

  const selectedToolName = useMemo(() => {
    if (selectedTools.length === 0) {
      return ''
    }

    return selectedTools[selectedTools.length - 1].id;
  }, [selectedTools])

  const submitDisabled = useMemo(
    () =>
      isSubmitting ||
      isLoadingProviders ||
      selectedProvider.trim().length === 0 ||
      (!activeFormTool && promptInput.trim().length === 0),
    [activeFormTool, isLoadingProviders, isSubmitting, promptInput, selectedProvider],
  )

  const inputLabel = 'Prompt'
  const inputPlaceholder = 'Enter your question or request here...'
  const providerLabel = isLoadingProviders
    ? 'Loading...'
    : selectedProvider || 'Unavailable'

  async function submitPrompt(
    prompt: string,
    sessionIdForRequest: string,
    provider: string,
    toolNameForRequest: string,
  ) {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload: AskRequestPayload = {
        prompt,
        provider,
      }
      const trimmedSessionId = sessionIdForRequest.trim()
      const trimmedToolName = toolNameForRequest.trim()

      if (trimmedSessionId) {
        payload.sessionId = trimmedSessionId
      }

      if (trimmedToolName) {
        payload.toolName = trimmedToolName
      }

      const response = await fetch(`${apiBaseUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPromptInput = promptInput.trim()
    const trimmedProvider = selectedProvider.trim()

    if (!trimmedProvider) {
      setErrorMessage('Please select a provider before sending.')
      return
    }

    if (!activeFormTool && !trimmedPromptInput) {
      setErrorMessage('Please enter text before calling the API.')
      return
    }

    if (activeFormTool) {
      const formValidationError = validateFormValues(activeFormTool, formValues)

      if (formValidationError) {
        setErrorMessage(formValidationError)
        return
      }
    }

    const promptBody = activeFormTool
      ? buildStructuredPrompt(activeFormTool, formValues)
      : trimmedPromptInput

    await submitPrompt(promptBody, sessionId, trimmedProvider, selectedToolName)
  }

  async function handleQuickAction(prompt: string) {
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt) {
      setErrorMessage('Quick action is missing a prompt payload.')
      return
    }

    const trimmedProvider = selectedProvider.trim()

    if (!trimmedProvider) {
      setErrorMessage('Please select a provider before sending.')
      return
    }

    await submitPrompt(trimmedPrompt, sessionId, trimmedProvider, selectedToolName)
  }

  function handleClear() {
    setPromptInput('')
    setFormValues({})
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
        <ToolSelector
          disabled={isSubmitting}
          onSelectionChange={(selection: ToolSelectionChange) => {
            const nextFormTools = selection.tools.filter((tool) => tool.requiresUserForm)
            const nextActiveFormTool =
              nextFormTools.length > 0 ? nextFormTools[nextFormTools.length - 1] : null

            if (nextActiveFormTool?.id !== activeFormTool?.id) {
              setFormValues({})
            }

            setSelectedTools(selection.tools)
          }}
        />

        {activeFormTool ? (
          <FormToolFields
            tool={activeFormTool}
            values={formValues}
            onChange={setFormValues}
            disabled={isSubmitting}
          />
        ) : (
          <>
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
          </>
        )}

        <div className="ask-panel__actions">
          <div className="ask-panel__actions-left">
            <button type="submit" disabled={submitDisabled}>
              {isSubmitting ? 'Sending...' : 'Send'}
            </button>
            <button className="ghost" type="button" onClick={handleClear} disabled={isSubmitting}>
              Clear
            </button>
          </div>

          <div className="ask-panel__provider-inline">
            <span className="ask-panel__provider-text">Provider: {providerLabel}</span>
            <button
              type="button"
              className="ask-panel__provider-gear"
              onClick={() => setIsProviderMenuOpen((isOpen) => !isOpen)}
              disabled={isSubmitting || isLoadingProviders || providers.length === 0}
              aria-label="Change provider"
              title="Change provider"
            >
              <FontAwesomeIcon icon={faGear} aria-hidden="true" />
            </button>
            {isProviderMenuOpen ? (
              <select
                id="providerSelect"
                name="providerSelect"
                className="ask-panel__provider-select-inline"
                value={selectedProvider}
                onChange={(event) => {
                  setSelectedProvider(event.target.value)
                  setIsProviderMenuOpen(false)
                }}
                disabled={isSubmitting || isLoadingProviders || providers.length === 0}
              >
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </form>

      {errorMessage ? (
        <p className="ask-panel__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {result ? (
        <AskResult
          result={result}
          onCopyError={setErrorMessage}
          onQuickAction={handleQuickAction}
          quickActionsDisabled={isSubmitting}
        />
      ) : null}
    </section>
  )
}
