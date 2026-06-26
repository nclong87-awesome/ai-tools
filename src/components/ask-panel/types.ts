export type AskResponse = {
  sessionId: string
  response: string
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
}

export type ToolOption = {
  id: string
  name: string
  description: string
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
