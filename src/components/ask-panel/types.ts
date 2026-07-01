export type AskResponse = {
  sessionId: string
  response: string
}

export type AskRequestPayload = {
  prompt: string
  provider: string
  model: string
  sessionId?: string
  toolName?: string
}

export type McpJsonRpcResponse = {
  result?: unknown
  error?: {
    message?: string
  }
}

export type McpTool = {
  name: string
  description?: string
  inputSchema?: unknown
}

export type ToolParameter = {
  name: string
  type: string
  isRequired: boolean
  description: string
}

export type ToolOption = {
  id: string
  name: string
  description: string
  requiresUserForm: boolean
  formId: string | null
  parameters: ToolParameter[]
}

export type ToolGroup = {
  id: string
  name: string
  description: string
  tools: ToolOption[]
}

export type ToolCatalog = {
  toolOptions: ToolOption[]
  toolGroups: ToolGroup[]
}

export type ToolSelectionChange = {
  toolIds: string[]
  tools: ToolOption[]
}
