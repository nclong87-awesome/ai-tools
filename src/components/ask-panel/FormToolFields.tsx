import { useEffect, useMemo, useRef } from 'react'
import { getFormFieldsForTool } from './formAwareTools'
import type { ToolOption } from './types'

type FormToolFieldsProps = {
  tool: ToolOption
  values: Record<string, string>
  disabled: boolean
  onChange: (nextValues: Record<string, string>) => void
}

export function FormToolFields({ tool, values, disabled, onChange }: FormToolFieldsProps) {
  const fields = useMemo(() => getFormFieldsForTool(tool), [tool])
  const formContainerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const firstField = formContainerRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'input, textarea',
    )
    firstField?.focus()
  }, [tool.id])

  function handleFieldChange(name: string, value: string) {
    onChange({
      ...values,
      [name]: value,
    })
  }

  if (fields.length === 0) {
    return null
  }

  return (
    <section className="ask-panel__tool-form" aria-live="polite" ref={formContainerRef}>
      <p className="ask-panel__tool-form-title">{tool.name} form</p>
      <p className="ask-panel__tool-form-subtitle">
        This tool requires structured input. Fill the fields below instead of free text.
      </p>
      <div className="ask-panel__tool-form-grid">
        {fields.map((field) => (
          <label key={field.name} className="ask-panel__tool-form-field" htmlFor={`tool-field-${field.name}`}>
            <span className="ask-panel__tool-form-label">
              {field.label}
              {field.required ? <span className="ask-panel__tool-form-required"> *</span> : null}
            </span>
            {field.inputType === 'textarea' ? (
              <textarea
                id={`tool-field-${field.name}`}
                className="ask-panel__tool-form-input"
                rows={field.name === 'content' ? 5 : 3}
                value={values[field.name] || ''}
                onChange={(event) => handleFieldChange(field.name, event.target.value)}
                disabled={disabled}
              />
            ) : (
              <input
                id={`tool-field-${field.name}`}
                className="ask-panel__tool-form-input"
                type={field.inputType}
                value={values[field.name] || ''}
                onChange={(event) => handleFieldChange(field.name, event.target.value)}
                disabled={disabled}
              />
            )}
            {field.description ? (
              <span className="ask-panel__tool-form-help">{field.description}</span>
            ) : null}
          </label>
        ))}
      </div>
    </section>
  )
}
