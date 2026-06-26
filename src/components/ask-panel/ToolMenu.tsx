import { useMemo } from 'react'
import type { ToolGroup, ToolOption } from './types'

type ToolMenuProps = {
  toolFilter: string
  onToolFilterChange: (value: string) => void
  filteredTools: ToolOption[]
  filteredToolGroups: ToolGroup[]
  expandedGroupIds: string[]
  selectedToolIds: string[]
  onToggleGroup: (groupId: string) => void
  onToggleToolSelection: (toolId: string) => void
}

export function ToolMenu({
  toolFilter,
  onToolFilterChange,
  filteredTools,
  filteredToolGroups,
  expandedGroupIds,
  selectedToolIds,
  onToggleGroup,
  onToggleToolSelection,
}: ToolMenuProps) {
  const isFiltering = toolFilter.trim().length > 0
  const flatFilteredTools = useMemo(() => {
    if (!isFiltering) {
      return []
    }

    const seen = new Set<string>()
    const uniqueTools: ToolOption[] = []

    for (const tool of filteredTools) {
      if (seen.has(tool.id)) {
        continue
      }

      seen.add(tool.id)
      uniqueTools.push(tool)
    }

    return uniqueTools
  }, [filteredTools, isFiltering])

  return (
    <div className="ask-panel__feature-menu-shell" id="tool-menu" aria-label="Available tools">
      <div className="ask-panel__feature-search-wrap">
        <input
          id="featureFilterInput"
          className="ask-panel__feature-search"
          type="text"
          placeholder="Filter by name or description"
          value={toolFilter}
          onChange={(event) => onToolFilterChange(event.target.value)}
          autoFocus
        />
        {toolFilter ? (
          <button
            type="button"
            className="ask-panel__feature-search-clear"
            onClick={() => onToolFilterChange('')}
            aria-label="Clear search"
            title="Clear"
          >
            ✕
          </button>
        ) : null}
      </div>
      {isFiltering ? (
        flatFilteredTools.length > 0 ? (
          <ul className="ask-panel__feature-menu">
            {flatFilteredTools.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  className={`ask-panel__feature-option${selectedToolIds.includes(tool.id) ? ' is-selected' : ''}`}
                  onClick={() => onToggleToolSelection(tool.id)}
                >
                  <span className="ask-panel__feature-name">{tool.name}</span>
                  <span className="ask-panel__feature-description">{tool.description}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ask-panel__feature-empty">No tools match your search.</p>
        )
      ) : filteredToolGroups.length > 0 ? (
        <div className="ask-panel__feature-groups">
          {filteredToolGroups.map((group) => (
            <section key={group.id} className="ask-panel__feature-group">
              <button
                type="button"
                className="ask-panel__feature-group-toggle"
                onClick={() => onToggleGroup(group.id)}
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
                        onClick={() => onToggleToolSelection(tool.id)}
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
  )
}
