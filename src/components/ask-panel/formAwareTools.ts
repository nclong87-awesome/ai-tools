import type { ToolOption, ToolParameter } from './types'

export type FormFieldDefinition = {
  name: string
  label: string
  required: boolean
  description: string
  inputType: 'text' | 'textarea' | 'password'
}

type FixedField = {
  name: string
  label: string
  inputType: 'text' | 'textarea' | 'password'
}

const knownFormLayouts: Record<string, FixedField[]> = {
  add_key_pass: [
    { name: 'title', label: 'Title', inputType: 'text' },
    { name: 'username', label: 'Username', inputType: 'text' },
    { name: 'password', label: 'Password', inputType: 'password' },
    { name: 'url', label: 'URL', inputType: 'text' },
    { name: 'group', label: 'Group', inputType: 'text' },
    { name: 'notes', label: 'Notes', inputType: 'textarea' },
  ],
  add_note: [
    { name: 'title', label: 'Title', inputType: 'text' },
    { name: 'source', label: 'Source', inputType: 'text' },
    { name: 'content', label: 'Content', inputType: 'textarea' },
    { name: 'notes', label: 'Notes', inputType: 'textarea' },
  ],
  update_note: [
    { name: 'id', label: 'Note ID', inputType: 'text' },
    { name: 'title', label: 'Title', inputType: 'text' },
    { name: 'source', label: 'Source', inputType: 'text' },
    { name: 'content', label: 'Content', inputType: 'textarea' },
    { name: 'notes', label: 'Notes', inputType: 'textarea' },
  ],
}

function toLabel(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (value) => value.toUpperCase())
}

function toGeneratedField(parameter: ToolParameter): FormFieldDefinition {
  const normalizedType = parameter.type.toLowerCase()
  const inputType =
    parameter.name.toLowerCase().includes('password')
      ? 'password'
      : normalizedType.includes('string') && parameter.name.toLowerCase().includes('content')
        ? 'textarea'
        : 'text'

  return {
    name: parameter.name,
    label: toLabel(parameter.name),
    required: parameter.isRequired,
    description: parameter.description,
    inputType,
  }
}

function buildOverridesByName(tool: ToolOption): Map<string, FixedField> {
  const knownLayout = tool.formId ? knownFormLayouts[tool.formId] : undefined
  return new Map((knownLayout || []).map((field) => [field.name, field]))
}

export function getFormFieldsForTool(tool: ToolOption): FormFieldDefinition[] {
  const overridesByName = buildOverridesByName(tool)

  if (tool.parameters.length > 0) {
    return tool.parameters.map((parameter) => {
      const generated = toGeneratedField(parameter)
      const override = overridesByName.get(parameter.name)

      if (!override) {
        return generated
      }

      return {
        ...generated,
        label: override.label,
        inputType: override.inputType,
      }
    })
  }

  const knownLayout = tool.formId ? knownFormLayouts[tool.formId] : undefined

  if (knownLayout) {
    return knownLayout.map((field) => ({
      name: field.name,
      label: field.label,
      required: false,
      description: '',
      inputType: field.inputType,
    }))
  }

  return []
}

export function validateFormValues(tool: ToolOption, values: Record<string, string>): string | null {
  const formFields = getFormFieldsForTool(tool)

  const missingRequiredField = formFields.find(
    (field) => field.required && !values[field.name]?.trim(),
  )

  if (missingRequiredField) {
    return `Please provide ${missingRequiredField.label}.`
  }

  return null
}

export function buildStructuredPrompt(tool: ToolOption, values: Record<string, string>): string {
  const payload: Record<string, string> = {}

  for (const [name, value] of Object.entries(values)) {
    const trimmedValue = value.trim()
    if (trimmedValue) {
      payload[name] = trimmedValue
    }
  }

  return `Structured form input for tool ${tool.id}:\n${JSON.stringify(payload, null, 2)}`
}
