import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AskResult } from './ask-panel/AskResult'
import { FormToolFields } from './ask-panel/FormToolFields'
import { ToolSelector } from './ask-panel/ToolSelector'
import { buildStructuredPrompt, validateFormValues } from './ask-panel/formAwareTools'
import type { AskResponse, ToolOption, ToolSelectionChange } from './ask-panel/types'
import './AskPanel.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'

function buildPromptWithSelectedTools(
  input: string,
  selectedToolIds: string[],
  currentSessionId: string,
): string {
  if (selectedToolIds.length === 0) {
    return input
  }

  if (currentSessionId.trim().length > 0) {
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
  const [selectedTools, setSelectedTools] = useState<ToolOption[]>([])
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }, [])

  const activeFormTool = useMemo(() => {
    if (selectedTools.length === 0) {
      return null
    }

    const formTools = selectedTools.filter((tool) => tool.requiresUserForm)
    return formTools.length > 0 ? formTools[formTools.length - 1] : null
  }, [selectedTools])

  const submitDisabled = useMemo(
    () => isSubmitting || (!activeFormTool && promptInput.trim().length === 0),
    [activeFormTool, isSubmitting, promptInput],
  )

  const inputLabel = 'Prompt'
  const inputPlaceholder = 'Enter your question or request here...'

  async function submitPrompt(prompt: string, sessionIdForRequest: string) {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, sessionId: sessionIdForRequest }),
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

    const outboundPrompt = buildPromptWithSelectedTools(promptBody, selectedToolIds, sessionId)

    await submitPrompt(outboundPrompt, sessionId)
  }

  async function handleQuickAction(prompt: string) {
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt) {
      setErrorMessage('Quick action is missing a prompt payload.')
      return
    }

    await submitPrompt(trimmedPrompt, sessionId)
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

            setSelectedToolIds(selection.toolIds)
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
