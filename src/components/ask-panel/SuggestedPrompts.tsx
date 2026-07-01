import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import type { ToolOption } from './types'

export type SuggestedPrompt = {
  prompt: string
  toolName: string | null
}

type SuggestedPromptsProps = {
  apiBaseUrl: string
  promptInput: string
  hasPromptFocusStarted: boolean
  activeFormTool: ToolOption | null
  selectedToolName: string
  isVisible: boolean
  disabled: boolean
  onApplySuggestion: (item: SuggestedPrompt) => void
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

export function SuggestedPrompts({
  apiBaseUrl,
  promptInput,
  hasPromptFocusStarted,
  activeFormTool,
  selectedToolName,
  isVisible,
  disabled,
  onApplySuggestion,
}: SuggestedPromptsProps) {
  const [isSuggestionSelectionActive, setIsSuggestionSelectionActive] = useState(false)
  const previousPromptLengthRef = useRef(promptInput.length)
  const skipNextPromptLengthCheckRef = useRef(false)

  const [debouncedPromptInput] = useDebounce(promptInput, 600)
  const shouldFetchSuggestedPrompts =
    isVisible && !activeFormTool && hasPromptFocusStarted && !isSuggestionSelectionActive && debouncedPromptInput.length >= 5

  useEffect(() => {
    const previousLength = previousPromptLengthRef.current
    const currentLength = promptInput.length

    if (skipNextPromptLengthCheckRef.current) {
      skipNextPromptLengthCheckRef.current = false
      previousPromptLengthRef.current = currentLength
      return
    }

    if (isSuggestionSelectionActive && currentLength > previousLength) {
      setIsSuggestionSelectionActive(false)
    }

    previousPromptLengthRef.current = currentLength
  }, [isSuggestionSelectionActive, promptInput])

  useEffect(() => {
    if (!isVisible) {
      const timeoutId = window.setTimeout(() => {
        setIsSuggestionSelectionActive(false)
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }
  }, [isVisible])

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

      return data.prompts
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
    },
  })

  const suggestedPrompts = suggestedPromptsQuery.data ?? []
  const isLoadingSuggestedPrompts = shouldFetchSuggestedPrompts && suggestedPromptsQuery.isFetching
  const showSuggestedPrompts = isVisible && (isLoadingSuggestedPrompts || suggestedPrompts.length > 0)

  if (activeFormTool) {
    return null
  }

  return (
    <section className="ask-panel__suggested-prompts-shell" aria-live="polite">
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
                  onClick={() => {
                    skipNextPromptLengthCheckRef.current = true
                    setIsSuggestionSelectionActive(true)
                    onApplySuggestion(suggestedPrompt)
                  }}
                  disabled={disabled}
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
    </section>
  )
}