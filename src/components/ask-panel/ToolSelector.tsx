import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faAdd } from '@fortawesome/free-solid-svg-icons'
import { loadMcpTools } from './toolCatalog'
import type { ToolGroup, ToolOption, ToolSelectionChange } from './types'

const lastUsedFeatureStorageKey = 'ask-panel:last-used-feature'
const selectedToolsStorageKey = 'ask-panel:selected-tools'

type ToolSelectorProps = {
  disabled: boolean
  onSelectionChange: (selection: ToolSelectionChange) => void
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

export function ToolSelector({ disabled, onSelectionChange }: ToolSelectorProps) {
  const [toolOptions, setToolOptions] = useState<ToolOption[]>([])
  const [toolGroups, setToolGroups] = useState<ToolGroup[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(true)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(() => readSelectedTools())
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)
  const [toolFilter, setToolFilter] = useState('')
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true

    async function fetchTools() {
      try {
        const loadedCatalog = await loadMcpTools()

        if (!isMounted) {
          return
        }

        const loadedTools = loadedCatalog.toolOptions
        setToolOptions(loadedTools)
        setToolGroups(loadedCatalog.toolGroups)

        const availableToolIdSet = new Set(loadedTools.map((tool) => tool.id))
        const storedTool = readLastUsedTool()
        const nextLastUsedToolId =
          storedTool && loadedTools.some((tool) => tool.id === storedTool)
            ? storedTool
            : loadedTools[0]?.id

        const nextSelectedToolIds = readSelectedTools().filter((toolId) => availableToolIdSet.has(toolId))

        setSelectedToolIds(nextSelectedToolIds)
        saveSelectedTools(nextSelectedToolIds)

        if (typeof window !== 'undefined' && nextLastUsedToolId) {
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

  useEffect(() => {
    onSelectionChange({
      toolIds: selectedToolIds,
      tools: selectedTools,
    })
  }, [onSelectionChange, selectedToolIds, selectedTools])

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

  const filteredToolGroups = useMemo(() => {
    if (toolGroups.length === 0) {
      return []
    }

    const filteredToolIdSet = new Set(filteredTools.map((tool) => tool.id))

    return toolGroups
      .map((group) => ({
        ...group,
        tools: group.tools.filter((tool) => filteredToolIdSet.has(tool.id)),
      }))
      .filter((group) => group.tools.length > 0)
  }, [filteredTools, toolGroups])

  const groupsWithSelectedTools = useMemo(() => {
    if (toolGroups.length === 0 || selectedToolIds.length === 0) {
      return []
    }

    const selectedToolIdSet = new Set(selectedToolIds)

    return toolGroups
      .filter((group) => group.tools.some((tool) => selectedToolIdSet.has(tool.id)))
      .map((group) => group.id)
  }, [selectedToolIds, toolGroups])

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

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(lastUsedFeatureStorageKey, toolId)
    }
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

      if (nextState) {
        setExpandedGroupIds(groupsWithSelectedTools)
      } else {
        setToolFilter('')
      }

      return nextState
    })
  }

  function handleToggleGroup(groupId: string) {
    setExpandedGroupIds((currentGroupIds) =>
      currentGroupIds.includes(groupId)
        ? currentGroupIds.filter((id) => id !== groupId)
        : [...currentGroupIds, groupId],
    )
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

  return (
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
              disabled={disabled}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
            </button>
          </span>
        ))}
        <span
          className="ask-panel__selected-tool-chip add-tools-button"
          onClick={handleToggleToolMenu}
          aria-label="Add tools"
          role="button"
        >
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
          {filteredToolGroups.length > 0 ? (
            <div className="ask-panel__feature-groups">
              {filteredToolGroups.map((group) => (
                <section key={group.id} className="ask-panel__feature-group">
                  <button
                    type="button"
                    className="ask-panel__feature-group-toggle"
                    onClick={() => handleToggleGroup(group.id)}
                    aria-expanded={expandedGroupIds.includes(group.id)}
                  >
                    <span className="ask-panel__feature-group-title">{group.name}</span>
                    <span
                      className={`ask-panel__feature-group-caret${expandedGroupIds.includes(group.id) ? ' is-expanded' : ''}`}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </button>
                  {group.description ? (
                    <p className="ask-panel__feature-group-description">{group.description}</p>
                  ) : null}
                  {expandedGroupIds.includes(group.id) ? (
                    <ul className="ask-panel__feature-menu">
                      {group.tools.map((tool) => (
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
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            <p className="ask-panel__feature-empty">No tools match your search.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
