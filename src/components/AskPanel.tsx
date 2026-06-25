import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faAdd } from '@fortawesome/free-solid-svg-icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './AskPanel.css'

type AskResponse = {
  sessionId: string
  response: string
}

type McpJsonRpcResponse = {
  result?: unknown
  error?: {
    message?: string
  }
}

type McpTool = {
  name: string
  description?: string
}

type ToolOption = {
  id: string
  name: string
  description: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888'
const mcpToolsUrl = import.meta.env.VITE_MCP_TOOLS_URL || 'http://localhost:5204/mcp'
const lastUsedFeatureStorageKey = 'ask-panel:last-used-feature'
const selectedToolsStorageKey = 'ask-panel:selected-tools'

function readJsonRpcFromPayload(payload: string): McpJsonRpcResponse {
  const trimmedPayload = payload.trim()

  if (!trimmedPayload) {
    throw new Error('Empty response from MCP server.')
  }

  if (trimmedPayload.startsWith('{')) {
    return JSON.parse(trimmedPayload) as McpJsonRpcResponse
  }

  const dataLines = trimmedPayload
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line.length > 0)

  if (dataLines.length === 0) {
    throw new Error('Unexpected MCP response format.')
  }

  return JSON.parse(dataLines[dataLines.length - 1]) as McpJsonRpcResponse
}

function toDisplayToolName(toolName: string): string {
  return toolName
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function toToolOption(tool: McpTool): ToolOption {
  return {
    id: tool.name,
    name: toDisplayToolName(tool.name),
    description: tool.description || `Use ${toDisplayToolName(tool.name)} in the request context.`,
  }
}

async function loadMcpTools(): Promise<ToolOption[]> {
  const initializeResponse = await fetch(mcpToolsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'init-web-ui',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        clientInfo: {
          name: 'web-app-ui',
          version: '1.0.0',
        },
        capabilities: {},
      },
    }),
  })

  if (!initializeResponse.ok) {
    throw new Error(`MCP initialize failed with status ${initializeResponse.status}.`)
  }

  const initializeSessionId = initializeResponse.headers.get('Mcp-Session-Id')
  const initializeBody = await initializeResponse.text()
  const initializeMessage = readJsonRpcFromPayload(initializeBody)

  if (initializeMessage.error) {
    throw new Error(initializeMessage.error.message || 'MCP initialize returned an error.')
  }

  if (!initializeSessionId) {
    throw new Error('MCP initialize did not return Mcp-Session-Id header.')
  }

  const toolsResponse = await fetch(mcpToolsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Mcp-Session-Id': initializeSessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools-list-web-ui',
      method: 'tools/list',
      params: {},
    }),
  })

  if (!toolsResponse.ok) {
    throw new Error(`MCP tools/list failed with status ${toolsResponse.status}.`)
  }

  const toolsBody = await toolsResponse.text()
  const toolsMessage = readJsonRpcFromPayload(toolsBody)

  if (toolsMessage.error) {
    throw new Error(toolsMessage.error.message || 'MCP tools/list returned an error.')
  }

  const tools = (toolsMessage.result as { tools?: McpTool[] } | undefined)?.tools

  if (!Array.isArray(tools) || tools.length === 0) {
    throw new Error('No tools returned from MCP tools/list.')
  }

  return tools.map(toToolOption)
}

function readLastUsedTool(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(lastUsedFeatureStorageKey)
}

function readSelectedTools(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  const stored = window.localStorage.getItem(selectedToolsStorageKey)

  if (!stored) {
    return []
  }

  try {
    const parsed = JSON.parse(stored) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveSelectedTools(toolIds: string[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(selectedToolsStorageKey, JSON.stringify(toolIds))
}

// function getToolById(toolId: string, availableTools: ToolOption[]): ToolOption {
//   return availableTools.find((tool) => tool.id === toolId) ?? availableTools[0]
// }

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
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [toolOptions, setToolOptions] = useState<ToolOption[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(true)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(() => readSelectedTools())
    // const [lastUsedToolId, setLastUsedToolId] = useState<string | null>(
    //   () => readLastUsedTool(),
    // )
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)
  const [toolFilter, setToolFilter] = useState('')
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function fetchTools() {
      try {
        const loadedTools = await loadMcpTools()

        if (!isMounted) {
          return
        }

        setToolOptions(loadedTools)

        const availableToolIdSet = new Set(loadedTools.map((tool) => tool.id))
        const storedTool = readLastUsedTool()
        const nextLastUsedToolId =
          storedTool && loadedTools.some((tool) => tool.id === storedTool)
            ? storedTool
            : loadedTools[0].id

        const nextSelectedToolIds = readSelectedTools().filter((toolId) => availableToolIdSet.has(toolId))

        setSelectedToolIds(nextSelectedToolIds)
        // setLastUsedToolId(nextLastUsedToolId)

        saveSelectedTools(nextSelectedToolIds)

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(lastUsedFeatureStorageKey, nextLastUsedToolId)
        }
      } catch (error) {
        console.error('Error loading MCP tools:', error)
      } finally {
        if (isMounted) {
          setIsLoadingTools(false)
        }
      }
    }

    void fetchTools()

    return () => {
      isMounted = false
    }
  }, [])

  const selectedTools = useMemo(() => {
    if (toolOptions.length === 0) {
      return []
    }

    return selectedToolIds
      .map((toolId) => toolOptions.find((tool) => tool.id === toolId))
      .filter((tool): tool is ToolOption => tool !== undefined)
  }, [selectedToolIds, toolOptions])

  const submitDisabled = useMemo(
    () => isSubmitting || promptInput.trim().length === 0,
    [isSubmitting, promptInput],
  )

  const filteredTools = useMemo(() => {
    const normalizedFilter = toolFilter.trim().toLowerCase()

    if (!normalizedFilter) {
      return toolOptions
    }

    return toolOptions.filter((tool) => {
      const searchableText = `${tool.name} ${tool.description}`.toLowerCase()
      return searchableText.includes(normalizedFilter)
    })
  }, [toolFilter, toolOptions])

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
    setIsCopied(false)
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
      if (selectedToolIds.length > 0) {
        const latestToolId = selectedToolIds[selectedToolIds.length - 1]
        // setLastUsedToolId(latestToolId)

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(lastUsedFeatureStorageKey, latestToolId)
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected error while calling Ask endpoint.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleToggleToolSelection(toolId: string) {
    setSelectedToolIds((currentToolIds) => {
      const isAlreadySelected = currentToolIds.includes(toolId)
      const nextToolIds = isAlreadySelected
        ? currentToolIds.filter((id) => id !== toolId)
        : [...currentToolIds, toolId]

      saveSelectedTools(nextToolIds)
      if (!isAlreadySelected) {
        setIsToolMenuOpen(false)
        setToolFilter('')
      }

      return nextToolIds
    })

    // setLastUsedToolId(toolId)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(lastUsedFeatureStorageKey, toolId)
    }

    setErrorMessage(null)
  }

  function handleRemoveSelectedTool(toolId: string) {
    setSelectedToolIds((currentToolIds) => {
      const nextToolIds = currentToolIds.filter((id) => id !== toolId)
      saveSelectedTools(nextToolIds)
      return nextToolIds
    })
  }

  function handleToggleToolMenu() {
    setIsToolMenuOpen((open) => {
      const nextState = !open

      if (!nextState) {
        setToolFilter('')
      }

      return nextState
    })
  }

  function closeToolMenu() {
    setIsToolMenuOpen(false)
    setToolFilter('')
  }

  useEffect(() => {
    if (!isToolMenuOpen) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeToolMenu()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isToolMenuOpen])

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
          <div className="ask-panel__selected-tools" aria-label="Selected tools">
            {selectedTools.map((tool) => (
              <span key={tool.id} className="ask-panel__selected-tool-chip">
                {tool.name}
                <button
                  type="button"
                  className="ask-panel__selected-tool-remove"
                  aria-label={`Remove ${tool.name}`}
                  onClick={() => handleRemoveSelectedTool(tool.id)}
                >
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              </span>
            ))}
            <span className="ask-panel__selected-tool-chip add-tools-button" onClick={handleToggleToolMenu} aria-label="Add tools" role="button">
              <FontAwesomeIcon icon={faAdd} aria-hidden="true" />
              Add tools
            </span>
            {isToolMenuOpen && (
              <span
                className="ask-panel__tool-menu-close-icon"
                onClick={closeToolMenu}
                aria-label="Close tools panel"
                title="Close"
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </span>
            )}
          </div>

          {isLoadingTools ? (
            <p className="ask-panel__last-used" aria-live="polite">
              Loading tools from MCP...
            </p>
          ) : toolOptions.length === 0 ? (
            <p className="ask-panel__last-used" aria-live="polite">
              No tools were loaded from MCP.
            </p>
          ) : null}

          {isToolMenuOpen ? (
            <div className="ask-panel__feature-menu-shell" id="tool-menu" aria-label="Available tools">
              <input
                id="featureFilterInput"
                className="ask-panel__feature-search"
                type="text"
                placeholder="Filter by name or description"
                value={toolFilter}
                onChange={(event) => setToolFilter(event.target.value)}
              />
              <p className="ask-panel__feature-count">
                Showing {filteredTools.length} of {toolOptions.length} tools
              </p>
              {filteredTools.length > 0 ? (
                <ul className="ask-panel__feature-menu">
                  {filteredTools.map((tool) => (
                    <li key={tool.id}>
                      <button
                        type="button"
                        className={`ask-panel__feature-option${selectedToolIds.includes(tool.id) ? ' is-selected' : ''}`}
                        onClick={() => handleToggleToolSelection(tool.id)}
                      >
                        <span className="ask-panel__feature-name">{tool.name}</span>
                        <span className="ask-panel__feature-description">{tool.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ask-panel__feature-empty">No tools match your search.</p>
              )}
            </div>
          ) : null}

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
