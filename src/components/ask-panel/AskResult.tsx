import { useMemo, useState } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import type { AskResponse } from './types'

type AskResultProps = {
  result: AskResponse
  onCopyError: (message: string) => void
  onQuickAction: (prompt: string) => void
  quickActionsDisabled: boolean
}

type QuickAction = {
  label: string
  prompt: string
}

const timestampFields = new Set(['created at', 'updated at'])
const fieldLinePattern = /^(\s*(?:[-*]\s+)?)\*\*([^*]+):\*\*\s*(.*)$/
const promptLinkPattern = /\s*\[[^\]]*\]\(prompt:[^)]+\)/gi

function normalizeFieldValueForPrompt(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/\n/g, '\\n').trim()
}

function isEmptyFieldValue(value: string): boolean {
  const trimmedValue = value.trim()
  return trimmedValue.length === 0 || trimmedValue.toLowerCase() === 'null'
}

function rewriteResponseWithInlineCopyActions(rawContent: string): string {
  const lines = rawContent.split('\n')
  const rewrittenLines: string[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const fieldMatch = line.match(fieldLinePattern)

    if (!fieldMatch) {
      rewrittenLines.push(line)
      continue
    }

    const [, prefix, fieldLabel, rawValue] = fieldMatch
    const trimmedFieldLabel = fieldLabel.trim()
    const cleanedValue = rawValue.replace(promptLinkPattern, '').trimEnd()
    const valueParts: string[] = []

    if (cleanedValue.trim().length > 0) {
      valueParts.push(cleanedValue)
    }

    let continuationIndex = lineIndex + 1
    while (continuationIndex < lines.length) {
      const continuationLine = lines[continuationIndex]
      if (!continuationLine.trim()) {
        break
      }
      if (fieldLinePattern.test(continuationLine)) {
        break
      }
      if (/^\s*#{1,6}\s/.test(continuationLine)) {
        break
      }
      if (/^\s*[-*_]{3,}\s*$/.test(continuationLine)) {
        break
      }

      valueParts.push(continuationLine)
      continuationIndex += 1
    }

    const combinedValue = valueParts.join('\n').trim()

    const isListField = prefix.trim().length > 0
    const hardBreakSuffix = isListField ? '' : '  '

    if (timestampFields.has(trimmedFieldLabel.toLowerCase()) || isEmptyFieldValue(combinedValue)) {
      rewrittenLines.push(
        `${prefix}**${trimmedFieldLabel}:**${cleanedValue ? ` ${cleanedValue}` : ''}${hardBreakSuffix}`,
      )
    } else {
      const promptPayload = normalizeFieldValueForPrompt(combinedValue)
      const encodedPrompt = encodeURIComponent(`Copy to clipboard: ${promptPayload}`)
      const valueSegment = cleanedValue ? ` ${cleanedValue}` : ''
      rewrittenLines.push(
        `${prefix}**${trimmedFieldLabel}:**${valueSegment} [⧉](prompt:${encodedPrompt})${hardBreakSuffix}`,
      )
    }

    for (let copyIndex = lineIndex + 1; copyIndex < continuationIndex; copyIndex += 1) {
      rewrittenLines.push(lines[copyIndex])
    }

    lineIndex = continuationIndex - 1
  }

  return rewrittenLines.join('\n')
}

function decodePromptPayload(href: string): string {
  const encodedPrompt = href.slice('prompt:'.length)

  try {
    return decodeURIComponent(encodedPrompt)
  } catch {
    return encodedPrompt
  }
}

function allowPromptUrlTransform(url: string): string {
  if (url.startsWith('prompt:')) {
    return url
  }

  return defaultUrlTransform(url)
}

function parseQuickActionBlock(rawContent: string): QuickAction | null {
  const lines = rawContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  let label = ''
  let prompt = ''

  for (const line of lines) {
    if (line.toLowerCase().startsWith('label:')) {
      label = line.slice('label:'.length).trim()
      continue
    }

    if (line.toLowerCase().startsWith('prompt:')) {
      prompt = line.slice('prompt:'.length).trim()
    }
  }

  if (!label || !prompt) {
    return null
  }

  return { label, prompt }
}

export function AskResult({
  result,
  onCopyError,
  onQuickAction,
  quickActionsDisabled,
}: AskResultProps) {
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const renderedResponse = useMemo(
    () => rewriteResponseWithInlineCopyActions(result.response),
    [result.response],
  )

  async function handleCopyResponse() {
    if (!result.response) {
      return
    }

    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(result.response)
      setIsCopied(true)
      toast.success('Response copied to clipboard.')
      window.setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error('Unable to copy response.')
      onCopyError('Unable to copy response. Please copy it manually.')
    } finally {
      setIsCopying(false)
    }
  }

  async function handleCopyFieldValue(fieldValue: string) {
    if (!fieldValue) {
      return
    }

    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(fieldValue)
      setIsCopied(true)
      toast.success('Field value copied to clipboard.')
      window.setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error('Unable to copy field value.')
      onCopyError('Unable to copy field value. Please copy it manually.')
    } finally {
      setIsCopying(false)
    }
  }

  const copyButtonLabel = isCopied ? 'Copied' : isCopying ? 'Copying response' : 'Copy response'

  return (
    <section className="ask-panel__result">
      <p className="ask-panel__meta">Session ID: {result.sessionId}</p>
      <div className="ask-panel__result-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={allowPromptUrlTransform}
          components={{
            a: ({ href, children, ...props }) => {
              if (typeof href === 'string' && href.startsWith('prompt:')) {
                const promptPayload = decodePromptPayload(href)
                const isInlineCopyAction = promptPayload
                  .toLowerCase()
                  .startsWith('copy to clipboard:')

                return (
                  <button
                    type="button"
                    className={
                      isInlineCopyAction
                        ? 'ask-panel__inline-copy-action'
                        : 'ask-panel__inline-prompt-action'
                    }
                    onClick={() =>
                      isInlineCopyAction
                        ? handleCopyFieldValue(promptPayload.replace(/^copy to clipboard:/i, '').trim())
                        : onQuickAction(promptPayload)
                    }
                    disabled={quickActionsDisabled}
                    aria-label={isInlineCopyAction ? 'Copy field value' : 'Run quick action'}
                    title={isInlineCopyAction ? 'Copy field value' : 'Run quick action'}
                  >
                    {isInlineCopyAction ? '⧉' : children}
                  </button>
                )
              }

              return <a href={href} {...props} target="_blank" rel="noopener noreferrer" />
            },
            pre: ({ children, ...props }) => {
              const firstChild = Array.isArray(children) ? children[0] : children
              const childClassName =
                typeof firstChild === 'object' && firstChild && 'props' in firstChild
                  ? (firstChild.props as { className?: string }).className
                  : undefined
              const isQuickAction = childClassName?.includes('language-quick-action')

              if (isQuickAction) {
                return <>{children}</>
              }

              return <pre {...props}>{children}</pre>
            },
            code: ({ className, children, ...props }) => {
              const isQuickAction = className?.includes('language-quick-action')

              if (isQuickAction) {
                const content = Array.isArray(children) ? children.join('') : String(children)
                const quickAction = parseQuickActionBlock(content)

                if (!quickAction) {
                  return null
                }

                return (
                  <button
                    type="button"
                    className="ask-panel__quick-action"
                    onClick={() => onQuickAction(quickAction.prompt)}
                    disabled={quickActionsDisabled}
                  >
                    {quickAction.label}
                  </button>
                )
              }

              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
          }}
        >
          {renderedResponse}
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
  )
}
