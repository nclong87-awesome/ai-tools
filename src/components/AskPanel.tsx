import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { AskResult } from './ask-panel/AskResult'
import { FormToolFields } from './ask-panel/FormToolFields'
import { ToolSelector } from './ask-panel/ToolSelector'
import { buildStructuredPrompt, validateFormValues } from './ask-panel/formAwareTools'
import type { AskRequestPayload, AskResponse, ToolOption, ToolSelectionChange } from './ask-panel/types'
import './AskPanel.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'
const providerStorageKey = 'askPanel.selectedProvider'

type SuggestedPrompt = {
  prompt: string
  toolName: string | null
}

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

function toSuggestedPromptLabel(prompt: string): string {
  const collapsed = prompt.replace(/\s+/g, ' ').trim()

  if (collapsed.length <= 110) {
    return collapsed
  }

  return `${collapsed.slice(0, 107).trimEnd()}...`
}

function toToolNameLabel(toolName: string): string {
  return toolName
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
  const [hasPromptFocusStarted, setHasPromptFocusStarted] = useState(false)
  const [isSuggestionSelectionActive, setIsSuggestionSelectionActive] = useState(false)
  const [selectionPreset, setSelectionPreset] = useState<string[] | null>(null)
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

    return selectedTools[selectedTools.length - 1].id
  }, [selectedTools])

  const [debouncedPromptInput] = useDebounce(promptInput, 600)
  const shouldFetchSuggestedPrompts =
    !activeFormTool && hasPromptFocusStarted && !isSuggestionSelectionActive && debouncedPromptInput.length >= 5

  const suggestedPromptsQuery = useQuery({
    queryKey: ['suggested-prompts', selectedToolName, debouncedPromptInput],
    enabled: shouldFetchSuggestedPrompts,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams()
      const trimmedToolName = selectedToolName.trim()

      params.set('limit', '3')

      if (trimmedToolName) {
        params.set('toolName', trimmedToolName)
      }

      params.set('text', debouncedPromptInput)

      const response = await fetch(`${apiBaseUrl}/suggested-prompts?${params.toString()}`, {
        signal,
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = (await response.json()) as { prompts?: unknown }

      if (!Array.isArray(data.prompts)) {
        return []
      }

      const normalizedPrompts = data.prompts
        .map((item) => {
          if (typeof item === 'string') {
            const normalizedPrompt = item.trim()

            if (!normalizedPrompt) {
              return null
            }

            return {
              prompt: normalizedPrompt,
              toolName: null,
            } satisfies SuggestedPrompt
          }

          if (!item || typeof item !== 'object') {
            return null
          }

          const rawItem = item as { prompt?: unknown; toolName?: unknown }
          const normalizedPrompt = typeof rawItem.prompt === 'string' ? rawItem.prompt.trim() : ''

          if (!normalizedPrompt) {
            return null
          }

          const normalizedToolName =
            typeof rawItem.toolName === 'string' && rawItem.toolName.trim().length > 0
              ? rawItem.toolName.trim()
              : null

          return {
            prompt: normalizedPrompt,
            toolName: normalizedToolName,
          } satisfies SuggestedPrompt
        })
        .filter((item): item is SuggestedPrompt => item !== null)
        .slice(0, 3)

      return normalizedPrompts
    },
  })

  const suggestedPrompts = suggestedPromptsQuery.data ?? []
  const isLoadingSuggestedPrompts = shouldFetchSuggestedPrompts && suggestedPromptsQuery.isFetching

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
    setHasPromptFocusStarted(false)
    setIsSuggestionSelectionActive(false)
    setSelectionPreset([])
    setSessionId('')
    setResult(null)
    setErrorMessage(null)

    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }

  const showSuggestedPrompts = !activeFormTool && (isLoadingSuggestedPrompts || suggestedPrompts.length > 0)

  function applySuggestedPrompt(item: SuggestedPrompt) {
    setIsSuggestionSelectionActive(true)
    setPromptInput(item.prompt)
    setErrorMessage(null)
    setSelectionPreset(item.toolName ? [item.toolName] : [])

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
          selectionPreset={selectionPreset}
          onSelectionChange={(selection: ToolSelectionChange) => {
            const nextFormTools = selection.tools.filter((tool) => tool.requiresUserForm)
            const nextActiveFormTool =
              nextFormTools.length > 0 ? nextFormTools[nextFormTools.length - 1] : null

            if (nextActiveFormTool?.id !== activeFormTool?.id) {
              setFormValues({})
            }

            setSelectedTools(selection.tools)

            if (selectionPreset !== null) {
              setSelectionPreset(null)
            }
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
              onChange={(event) => {
                const nextPromptValue = event.target.value

                if (isSuggestionSelectionActive && nextPromptValue.length > promptInput.length) {
                  setIsSuggestionSelectionActive(false)
                }

                setPromptInput(nextPromptValue)
              }}
              onFocus={() => setHasPromptFocusStarted(true)}
              rows={7}
              placeholder={inputPlaceholder}
              disabled={isSubmitting}
            />

            {showSuggestedPrompts ? (
              <section className="ask-panel__suggested-prompts" aria-label="Suggested prompts" aria-live="polite">
                <div className="ask-panel__suggested-prompts-header">
                  <p className="ask-panel__suggested-prompts-title">Suggested prompts</p>
                  <p className="ask-panel__suggested-prompts-subtitle">Pick one to fill the prompt box</p>
                </div>
                {isLoadingSuggestedPrompts ? (
                  <p className="ask-panel__suggested-prompts-hint">Loading suggestions...</p>
                ) : (
                  <div className="ask-panel__suggested-prompts-list">
                    {suggestedPrompts.map((suggestedPrompt, index) => (
                      <button
                        key={`${suggestedPrompt.prompt}:${suggestedPrompt.toolName ?? 'none'}:${index}`}
                        type="button"
                        className="ask-panel__suggested-prompt"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySuggestedPrompt(suggestedPrompt)}
                        disabled={isSubmitting}
                        title={suggestedPrompt.prompt}
                      >
                        <span className="ask-panel__suggested-prompt-icon" aria-hidden="true">
                          ↳
                        </span>
                        <span className="ask-panel__suggested-prompt-content">
                          <span className="ask-panel__suggested-prompt-text">
                            {toSuggestedPromptLabel(suggestedPrompt.prompt)}
                          </span>
                          <span className="ask-panel__suggested-prompt-meta">
                            {suggestedPrompt.toolName ? toToolNameLabel(suggestedPrompt.toolName) : 'No tool'}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
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
