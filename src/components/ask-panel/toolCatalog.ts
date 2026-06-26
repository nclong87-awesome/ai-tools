import type {
  McpJsonRpcResponse,
  McpTool,
  ToolCatalog,
  ToolGroup,
  ToolOption,
  ToolParameter,
} from './types'

const mcpToolsUrl = import.meta.env.VITE_MCP_TOOLS_URL || 'http://localhost:5204/mcp'
const mcpToolGroupsUrl =
  import.meta.env.VITE_MCP_TOOL_GROUPS_URL || 'http://localhost:5204/tool-groups'

const defaultToolGroupName = 'All tools'

function toGroupId(groupName: string): string {
  return (
    groupName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'tools'
  )
}

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

function normalizeParametersFromUnknown(rawParameters: unknown): ToolParameter[] {
  if (!Array.isArray(rawParameters)) {
    return []
  }

  return rawParameters
    .map((rawParameter) => {
      if (!rawParameter || typeof rawParameter !== 'object') {
        return null
      }

      const parameter = rawParameter as {
        name?: unknown
        Name?: unknown
        type?: unknown
        Type?: unknown
        isRequired?: unknown
        IsRequired?: unknown
        description?: unknown
        Description?: unknown
      }

      const name =
        (typeof parameter.name === 'string' && parameter.name) ||
        (typeof parameter.Name === 'string' && parameter.Name) ||
        ''

      if (!name) {
        return null
      }

      const type =
        (typeof parameter.type === 'string' && parameter.type) ||
        (typeof parameter.Type === 'string' && parameter.Type) ||
        'string'

      const isRequired =
        (typeof parameter.isRequired === 'boolean' && parameter.isRequired) ||
        (typeof parameter.IsRequired === 'boolean' && parameter.IsRequired) ||
        false

      const description =
        (typeof parameter.description === 'string' && parameter.description) ||
        (typeof parameter.Description === 'string' && parameter.Description) ||
        ''

      return {
        name,
        type,
        isRequired,
        description,
      }
    })
    .filter((parameter): parameter is ToolParameter => parameter !== null)
}

function parametersFromInputSchema(inputSchema: unknown): ToolParameter[] {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return []
  }

  const schema = inputSchema as {
    properties?: unknown
    required?: unknown
  }

  if (!schema.properties || typeof schema.properties !== 'object') {
    return []
  }

  const requiredNames = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((name): name is string => typeof name === 'string')
      : [],
  )

  const properties = schema.properties as Record<string, unknown>
  const parameters: ToolParameter[] = []

  for (const [name, rawProperty] of Object.entries(properties)) {
    if (!rawProperty || typeof rawProperty !== 'object') {
      continue
    }

    const property = rawProperty as {
      type?: unknown
      description?: unknown
    }

    const type =
      typeof property.type === 'string'
        ? property.type
        : Array.isArray(property.type)
          ? property.type.find((value): value is string => typeof value === 'string') || 'string'
          : 'string'

    parameters.push({
      name,
      type,
      isRequired: requiredNames.has(name),
      description: typeof property.description === 'string' ? property.description : '',
    })
  }

  return parameters
}

function toToolOption(tool: McpTool): ToolOption {
  const parameters = parametersFromInputSchema(tool.inputSchema)

  return {
    id: tool.name,
    name: toDisplayToolName(tool.name),
    description: tool.description || `Use ${toDisplayToolName(tool.name)} in the request context.`,
    requiresUserForm: false,
    formId: null,
    parameters,
  }
}

function normalizeGroupFromUnknown(rawGroup: unknown): ToolGroup | null {
  if (!rawGroup || typeof rawGroup !== 'object') {
    return null
  }

  const raw = rawGroup as {
    id?: unknown
    key?: unknown
    Key?: unknown
    Id?: unknown
    name?: unknown
    Name?: unknown
    description?: unknown
    Description?: unknown
    category?: unknown
    className?: unknown
    class?: unknown
    tools?: unknown
    Tools?: unknown
    items?: unknown
    entries?: unknown
  }

  const groupNameCandidate =
    (typeof raw.name === 'string' && raw.name) ||
    (typeof raw.Name === 'string' && raw.Name) ||
    (typeof raw.category === 'string' && raw.category) ||
    (typeof raw.className === 'string' && raw.className) ||
    (typeof raw.class === 'string' && raw.class) ||
    defaultToolGroupName

  const groupDescription =
    (typeof raw.description === 'string' && raw.description) ||
    (typeof raw.Description === 'string' && raw.Description) ||
    ''
  const rawTools =
    (Array.isArray(raw.tools) && raw.tools) ||
    (Array.isArray(raw.Tools) && raw.Tools) ||
    (Array.isArray(raw.items) && raw.items) ||
    (Array.isArray(raw.entries) && raw.entries) ||
    []

  const tools: ToolOption[] = rawTools
    .map((rawTool) => {
      if (!rawTool || typeof rawTool !== 'object') {
        return null
      }

      const tool = rawTool as {
        name?: unknown
        Name?: unknown
        id?: unknown
        Id?: unknown
        suggestedClientName?: unknown
        SuggestedClientName?: unknown
        codeName?: unknown
        CodeName?: unknown
        description?: unknown
        Description?: unknown
        requiresUserForm?: unknown
        RequiresUserForm?: unknown
        formId?: unknown
        FormId?: unknown
        parameters?: unknown
        Parameters?: unknown
        tool?: { name?: unknown; description?: unknown }
      }

      const toolName =
        (typeof tool.name === 'string' && tool.name) ||
        (typeof tool.Name === 'string' && tool.Name) ||
        (typeof tool.id === 'string' && tool.id) ||
        (typeof tool.Id === 'string' && tool.Id) ||
        (typeof tool.suggestedClientName === 'string' && tool.suggestedClientName) ||
        (typeof tool.SuggestedClientName === 'string' && tool.SuggestedClientName) ||
        (typeof tool.codeName === 'string' && tool.codeName) ||
        (typeof tool.CodeName === 'string' && tool.CodeName) ||
        (tool.tool && typeof tool.tool.name === 'string' && tool.tool.name) ||
        ''

      if (!toolName) {
        return null
      }

      const toolDescription =
        (typeof tool.description === 'string' && tool.description) ||
        (typeof tool.Description === 'string' && tool.Description) ||
        (tool.tool && typeof tool.tool.description === 'string' && tool.tool.description) ||
        undefined

      const requiresUserForm =
        (typeof tool.requiresUserForm === 'boolean' && tool.requiresUserForm) ||
        (typeof tool.RequiresUserForm === 'boolean' && tool.RequiresUserForm) ||
        false

      const formId =
        (typeof tool.formId === 'string' && tool.formId) ||
        (typeof tool.FormId === 'string' && tool.FormId) ||
        null

      const parameters = normalizeParametersFromUnknown(tool.parameters ?? tool.Parameters)

      return {
        ...toToolOption({ name: toolName, description: toolDescription }),
        requiresUserForm,
        formId,
        parameters,
      }
    })
    .filter((tool): tool is ToolOption => tool !== null)

  if (tools.length === 0) {
    return null
  }

  const providedGroupId =
    (typeof raw.id === 'string' && raw.id) ||
    (typeof raw.Id === 'string' && raw.Id) ||
    (typeof raw.key === 'string' && raw.key) ||
    (typeof raw.Key === 'string' && raw.Key) ||
    null

  return {
    id: providedGroupId || toGroupId(groupNameCandidate),
    name: groupNameCandidate,
    description: groupDescription,
    tools,
  }
}

function normalizeGroupedCatalog(rawGroups: unknown[]): ToolCatalog {
  const normalizedGroups = rawGroups
    .map(normalizeGroupFromUnknown)
    .filter((group): group is ToolGroup => group !== null)

  if (normalizedGroups.length === 0) {
    return {
      toolOptions: [],
      toolGroups: [],
    }
  }

  const uniqueTools = new Map<string, ToolOption>()
  const deduplicatedGroups = normalizedGroups.map((group) => {
    const uniqueGroupTools: ToolOption[] = []

    for (const tool of group.tools) {
      if (!uniqueTools.has(tool.id)) {
        uniqueTools.set(tool.id, tool)
      }

      if (!uniqueGroupTools.some((groupTool) => groupTool.id === tool.id)) {
        uniqueGroupTools.push(tool)
      }
    }

    return {
      ...group,
      tools: uniqueGroupTools,
    }
  })

  return {
    toolOptions: Array.from(uniqueTools.values()),
    toolGroups: deduplicatedGroups,
  }
}

function buildFallbackCatalogFromTools(toolOptions: ToolOption[]): ToolCatalog {
  return {
    toolOptions,
    toolGroups:
      toolOptions.length > 0
        ? [
            {
              id: toGroupId(defaultToolGroupName),
              name: defaultToolGroupName,
              description: '',
              tools: toolOptions,
            },
          ]
        : [],
  }
}

function extractGroupedCatalogFromToolCallResult(result: unknown): ToolCatalog | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const maybe = result as {
    groups?: unknown
    Groups?: unknown
    catalog?: { groups?: unknown }
    Catalog?: { groups?: unknown; Groups?: unknown }
    structuredContent?: { groups?: unknown }
    StructuredContent?: { groups?: unknown; Groups?: unknown }
    content?: Array<{ type?: string; text?: string; Type?: string; Text?: string }>
    Content?: Array<{ type?: string; text?: string; Type?: string; Text?: string }>
  }

  const directGroups =
    (Array.isArray(maybe.groups) && maybe.groups) ||
    (Array.isArray(maybe.Groups) && maybe.Groups) ||
    (maybe.catalog && Array.isArray(maybe.catalog.groups) && maybe.catalog.groups) ||
    (maybe.Catalog && Array.isArray(maybe.Catalog.groups) && maybe.Catalog.groups) ||
    (maybe.Catalog && Array.isArray(maybe.Catalog.Groups) && maybe.Catalog.Groups) ||
    (maybe.structuredContent &&
      Array.isArray(maybe.structuredContent.groups) &&
      maybe.structuredContent.groups) ||
    (maybe.StructuredContent &&
      Array.isArray(maybe.StructuredContent.groups) &&
      maybe.StructuredContent.groups) ||
    (maybe.StructuredContent &&
      Array.isArray(maybe.StructuredContent.Groups) &&
      maybe.StructuredContent.Groups) ||
    null

  if (directGroups) {
    const normalized = normalizeGroupedCatalog(directGroups)
    return normalized.toolOptions.length > 0 ? normalized : null
  }

  const contentItems =
    (Array.isArray(maybe.content) && maybe.content) ||
    (Array.isArray(maybe.Content) && maybe.Content) ||
    []

  if (contentItems.length > 0) {
    for (const item of contentItems) {
      const itemType =
        (typeof item.type === 'string' && item.type) ||
        (typeof item.Type === 'string' && item.Type) ||
        ''
      const itemText =
        (typeof item.text === 'string' && item.text) ||
        (typeof item.Text === 'string' && item.Text) ||
        ''

      if (itemType !== 'text' || !itemText) {
        continue
      }

      try {
        const parsed = JSON.parse(itemText) as { groups?: unknown; Groups?: unknown }

        const parsedGroups =
          (Array.isArray(parsed.groups) && parsed.groups) ||
          (Array.isArray(parsed.Groups) && parsed.Groups) ||
          null

        if (parsedGroups) {
          const normalized = normalizeGroupedCatalog(parsedGroups)
          if (normalized.toolOptions.length > 0) {
            return normalized
          }
        }
      } catch {
        // Ignore text blocks that are not JSON.
      }
    }
  }

  return null
}

export async function loadMcpTools(): Promise<ToolCatalog> {
  try {
    const groupedResponse = await fetch(mcpToolGroupsUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (groupedResponse.ok) {
      const payload = (await groupedResponse.json()) as { groups?: unknown; Groups?: unknown }
      const groups =
        (Array.isArray(payload.groups) && payload.groups) ||
        (Array.isArray(payload.Groups) && payload.Groups) ||
        null

      if (groups) {
        const groupedCatalog = normalizeGroupedCatalog(groups)

        if (groupedCatalog.toolOptions.length > 0) {
          return groupedCatalog
        }
      }
    }
  } catch {
    // Fall back to MCP calls below.
  }

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

  const groupedToolsCallResponse = await fetch(mcpToolsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Mcp-Session-Id': initializeSessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'tool-catalog-web-ui',
      method: 'tools/call',
      params: {
        name: 'get_tool_catalog',
        arguments: {},
      },
    }),
  })

  if (groupedToolsCallResponse.ok) {
    const groupedToolsCallBody = await groupedToolsCallResponse.text()
    const groupedToolsCallMessage = readJsonRpcFromPayload(groupedToolsCallBody)

    if (!groupedToolsCallMessage.error) {
      const groupedCatalog = extractGroupedCatalogFromToolCallResult(groupedToolsCallMessage.result)

      if (groupedCatalog) {
        return groupedCatalog
      }
    }
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

  return buildFallbackCatalogFromTools(tools.map(toToolOption))
}
