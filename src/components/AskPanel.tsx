import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AskResult } from './ask-panel/AskResult'
import { FormToolFields } from './ask-panel/FormToolFields'
import {
  ProviderModelSelector,
  type ProviderModelSelectionState,
} from './ask-panel/ProviderModelSelector'
import { SuggestedPrompts } from './ask-panel/SuggestedPrompts'
import { ToolSelector } from './ask-panel/ToolSelector'
import { buildStructuredPrompt, validateFormValues } from './ask-panel/formAwareTools'
import type { AskRequestPayload, AskResponse, ToolOption, ToolSelectionChange } from './ask-panel/types'
import './AskPanel.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'
const selectedToolsStorageKey = 'ask-panel:selected-tools'

function readStoredSelectedToolIds(): string[] {
  try {
    const value = window.localStorage.getItem(selectedToolsStorageKey)

    if (!value) {
      return []
    }

    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const initialProviderModelSelectionState: ProviderModelSelectionState = {
  selectedProvider: '',
  selectedModel: '',
  providers: [],
  models: [],
  isLoadingProviders: true,
  isLoadingModels: false,
  availabilityWarning: null,
  loadErrorMessage: null,
}

export function AskPanel() {
  const [promptInput, setPromptInput] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [providerModelState, setProviderModelState] = useState<ProviderModelSelectionState>(
    initialProviderModelSelectionState,
  )
  const [result, setResult] = useState<AskResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(() => readStoredSelectedToolIds())
  const [selectedTools, setSelectedTools] = useState<ToolOption[]>([])
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [hasPromptFocusStarted, setHasPromptFocusStarted] = useState(false)
  const [isSuggestedPromptsVisible, setIsSuggestedPromptsVisible] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }, [])

  const {
    selectedProvider,
    selectedModel,
    providers,
    models,
    isLoadingProviders,
    isLoadingModels,
    availabilityWarning,
    loadErrorMessage,
  } = providerModelState
  const displayedErrorMessage = errorMessage ?? loadErrorMessage

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

  const submitDisabled = useMemo(
    () =>
      isSubmitting ||
      isLoadingProviders ||
      isLoadingModels ||
      selectedProvider.trim().length === 0 ||
      selectedModel.trim().length === 0 ||
      (!activeFormTool && promptInput.trim().length === 0),
    [activeFormTool, isLoadingModels, isLoadingProviders, isSubmitting, promptInput, selectedModel, selectedProvider],
  )

  const inputLabel = 'Prompt'
  const inputPlaceholder = 'Enter your question or request here...'

  async function submitPrompt(
    prompt: string,
    sessionIdForRequest: string,
    provider: string,
    model: string,
    toolNameForRequest: string,
  ) {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload: AskRequestPayload = {
        prompt,
        provider,
        model,
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
        error instanceof Error ? error.message : 'Unexpected error while calling orchestrate endpoint.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPromptInput = promptInput.trim()
    const trimmedProvider = selectedProvider.trim()
    const trimmedModel = selectedModel.trim()

    if (!trimmedProvider) {
      setErrorMessage('Please select a provider before sending.')
      return
    }

    if (!providers.includes(trimmedProvider)) {
      setErrorMessage('Selected provider is unavailable. Please choose another provider.')
      return
    }

    if (!trimmedModel) {
      setErrorMessage('Please select a model before sending.')
      return
    }

    if (!models.includes(trimmedModel)) {
      setErrorMessage('Selected model is unavailable for the current provider.')
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

    await submitPrompt(promptBody, sessionId, trimmedProvider, trimmedModel, selectedToolName)
  }

  async function handleQuickAction(prompt: string) {
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt) {
      setErrorMessage('Quick action is missing a prompt payload.')
      return
    }

    const trimmedProvider = selectedProvider.trim()
    const trimmedModel = selectedModel.trim()

    if (!trimmedProvider) {
      setErrorMessage('Please select a provider before sending.')
      return
    }

    if (!trimmedModel) {
      setErrorMessage('Please select a model before sending.')
      return
    }

    await submitPrompt(trimmedPrompt, sessionId, trimmedProvider, trimmedModel, selectedToolName)
  }

  function handleClear() {
    setPromptInput('')
    setFormValues({})
    setHasPromptFocusStarted(false)
    setSessionId('')
    setResult(null)
    setErrorMessage(null)

    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }

  function applySuggestedPrompt(item: { prompt: string; toolName: string | null }) {
    setPromptInput(item.prompt)
    setErrorMessage(null)
    setSelectedToolIds(item.toolName ? [item.toolName] : [])

    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }

  return (
    <section className="ask-panel" aria-live="polite">
      <header className="ask-panel__header">
        <p className="ask-panel__eyebrow">AI tools</p>
      </header>
      <form className="ask-panel__form" onSubmit={handleSubmit}>
        <ToolSelector
          disabled={isSubmitting}
          selectedToolIds={selectedToolIds}
          onSelectedToolIdsChange={setSelectedToolIds}
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
            <div className="ask-panel__prompt-label-row">
              <label htmlFor="promptInput">{inputLabel}</label>
              <label htmlFor="showSuggestedPrompts" className="ask-panel__prompt-toggle">
                <input
                  id="showSuggestedPrompts"
                  type="checkbox"
                  checked={isSuggestedPromptsVisible}
                  onChange={(event) => setIsSuggestedPromptsVisible(event.target.checked)}
                  disabled={isSubmitting}
                />
                Show suggestions
              </label>
            </div>
            <textarea
              id="promptInput"
              ref={textAreaRef}
              name="promptInput"
              value={promptInput}
              onChange={(event) => setPromptInput(event.target.value)}
              onFocus={() => setHasPromptFocusStarted(true)}
              rows={7}
              placeholder={inputPlaceholder}
              disabled={isSubmitting}
            />

            <SuggestedPrompts
              apiBaseUrl={apiBaseUrl}
              promptInput={promptInput}
              hasPromptFocusStarted={hasPromptFocusStarted}
              activeFormTool={activeFormTool}
              selectedToolName={selectedToolName}
              isVisible={isSuggestedPromptsVisible}
              disabled={isSubmitting}
              onApplySuggestion={applySuggestedPrompt}
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

          <ProviderModelSelector
            apiBaseUrl={apiBaseUrl}
            disabled={isSubmitting}
            onStateChange={setProviderModelState}
          />
        </div>

        {availabilityWarning ? <p className="ask-panel__availability-warning">{availabilityWarning}</p> : null}
      </form>

      {displayedErrorMessage ? (
        <p className="ask-panel__error" role="alert">
          {displayedErrorMessage}
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
