import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'

type ProviderMetadata = {
  providers: Record<string, string[]>
}

export type ProviderModelSelectionState = {
  selectedProvider: string
  selectedModel: string
  providers: string[]
  models: string[]
  isLoadingProviders: boolean
  isLoadingModels: boolean
  availabilityWarning: string | null
  loadErrorMessage: string | null
}

type ProviderModelSelectorProps = {
  apiBaseUrl: string
  disabled: boolean
  onStateChange: (state: ProviderModelSelectionState) => void
}

const providerStorageKey = 'askPanel.selectedProvider'
const modelStorageKeyPrefix = 'askPanel.selectedModel.'

function readStoredProvider(): string {
  try {
    const value = window.localStorage.getItem(providerStorageKey)
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

function writeStoredProvider(provider: string): void {
  try {
    const trimmedProvider = provider.trim()

    if (!trimmedProvider) {
      window.localStorage.removeItem(providerStorageKey)
      return
    }

    window.localStorage.setItem(providerStorageKey, trimmedProvider)
  } catch {
    // Ignore storage write failures and continue using in-memory state.
  }
}

function modelStorageKey(provider: string): string {
  return `${modelStorageKeyPrefix}${encodeURIComponent(provider.trim())}`
}

function readStoredModel(provider: string): string {
  const trimmedProvider = provider.trim()

  if (!trimmedProvider) {
    return ''
  }

  try {
    const value = window.localStorage.getItem(modelStorageKey(trimmedProvider))
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

function writeStoredModel(provider: string, model: string): void {
  const trimmedProvider = provider.trim()

  if (!trimmedProvider) {
    return
  }

  try {
    const trimmedModel = model.trim()

    if (!trimmedModel) {
      window.localStorage.removeItem(modelStorageKey(trimmedProvider))
      return
    }

    window.localStorage.setItem(modelStorageKey(trimmedProvider), trimmedModel)
  } catch {
    // Ignore storage write failures and continue using in-memory state.
  }
}

function normalizeStringList(rawValue: unknown): string[] {
  if (!Array.isArray(rawValue)) {
    return []
  }

  return Array.from(
    new Set(rawValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)),
  )
}

function normalizeProvidersMap(rawValue: unknown): Record<string, string[]> {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return {}
  }

  const record = rawValue as Record<string, unknown>
  const providersMap: Record<string, string[]> = {}

  for (const [providerName, rawModels] of Object.entries(record)) {
    const trimmedProviderName = providerName.trim()

    if (!trimmedProviderName) {
      continue
    }

    providersMap[trimmedProviderName] = normalizeStringList(rawModels)
  }

  return providersMap
}

function parseProviderMetadata(payload: unknown): ProviderMetadata {
  if (!payload || typeof payload !== 'object') {
    return { providers: {} }
  }

  const rawPayload = payload as { providers?: unknown }

  return {
    providers: normalizeProvidersMap(rawPayload.providers),
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

async function fetchProviderMetadata(apiBaseUrl: string): Promise<ProviderMetadata> {
  const response = await fetch(`${apiBaseUrl}/providers`)

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || `Request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  return parseProviderMetadata(payload)
}

export function ProviderModelSelector({ apiBaseUrl, disabled, onStateChange }: ProviderModelSelectorProps) {
  const [storedProvider] = useState(() => readStoredProvider())
  const [userSelectedProvider, setUserSelectedProvider] = useState('')
  const [userSelectedModel, setUserSelectedModel] = useState('')
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false)

  const providersQuery = useQuery({
    queryKey: ['providers', apiBaseUrl],
    queryFn: () => fetchProviderMetadata(apiBaseUrl),
  })

  const providersMap = useMemo(() => providersQuery.data?.providers ?? {}, [providersQuery.data])
  const providers = useMemo(() => Object.keys(providersMap), [providersMap])

  const selectedProvider = useMemo(() => {
    if (providers.length === 0) {
      return ''
    }

    if (userSelectedProvider && Object.prototype.hasOwnProperty.call(providersMap, userSelectedProvider)) {
      return userSelectedProvider
    }

    if (storedProvider && Object.prototype.hasOwnProperty.call(providersMap, storedProvider)) {
      return storedProvider
    }

    return providers[0]
  }, [providers, providersMap, storedProvider, userSelectedProvider])

  useEffect(() => {
    writeStoredProvider(selectedProvider)
  }, [selectedProvider])

  const models = useMemo(
    () => (selectedProvider ? providersMap[selectedProvider] ?? [] : []),
    [providersMap, selectedProvider],
  )

  const selectedModel = useMemo(() => {
    if (models.length === 0) {
      return ''
    }

    if (userSelectedModel && models.includes(userSelectedModel)) {
      return userSelectedModel
    }

    const storedModel = readStoredModel(selectedProvider)

    if (storedModel && models.includes(storedModel)) {
      return storedModel
    }

    return models[0]
  }, [models, selectedProvider, userSelectedModel])

  useEffect(() => {
    writeStoredModel(selectedProvider, selectedModel)
  }, [selectedModel, selectedProvider])

  const isLoadingProviders = providersQuery.isPending
  const isLoadingModels = false

  const availabilityWarning = useMemo(() => {
    if (!isLoadingProviders && providers.length === 0) {
      return 'No providers are currently available.'
    }

    if (selectedProvider && models.length === 0) {
      return `No models are currently available for ${selectedProvider}.`
    }

    return null
  }, [isLoadingProviders, models.length, providers.length, selectedProvider])

  const loadErrorMessage = useMemo(() => {
    if (providersQuery.isError) {
      return toErrorMessage(providersQuery.error, 'Unexpected error while loading providers.')
    }

    return null
  }, [providersQuery.error, providersQuery.isError])

  useEffect(() => {
    onStateChange({
      selectedProvider,
      selectedModel,
      providers,
      models,
      isLoadingProviders,
      isLoadingModels,
      availabilityWarning,
      loadErrorMessage,
    })
  }, [
    availabilityWarning,
    isLoadingModels,
    isLoadingProviders,
    loadErrorMessage,
    models,
    onStateChange,
    providers,
    selectedModel,
    selectedProvider,
  ])

  const providerLabel = isLoadingProviders ? 'Loading...' : selectedProvider || 'Unavailable'
  const modelLabel = isLoadingModels ? 'Loading...' : selectedModel || 'Unavailable'

  return (
    <div className="ask-panel__provider-inline">
      <span className="ask-panel__provider-text">Provider: {providerLabel} ({modelLabel})</span>
      <button
        type="button"
        className="ask-panel__provider-gear"
        onClick={() => setIsProviderMenuOpen((isOpen) => !isOpen)}
        disabled={disabled || isLoadingProviders || providers.length === 0}
        aria-label="Change provider"
        title="Change provider"
      >
        <FontAwesomeIcon icon={faGear} aria-hidden="true" />
      </button>
      {isProviderMenuOpen ? (
        <>
          <select
            id="providerSelect"
            name="providerSelect"
            className="ask-panel__provider-select-inline"
            value={selectedProvider}
            onChange={(event) => {
              setUserSelectedProvider(event.target.value)
              setUserSelectedModel('')
              setIsProviderMenuOpen(false)
            }}
            disabled={disabled || isLoadingProviders || providers.length === 0}
          >
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <select
            id="modelSelect"
            name="modelSelect"
            className="ask-panel__model-select-inline"
            value={selectedModel}
            onChange={(event) => setUserSelectedModel(event.target.value)}
            disabled={disabled || isLoadingProviders || isLoadingModels || providers.length === 0}
          >
            {isLoadingModels ? <option value="">Loading models...</option> : null}
            {!isLoadingModels && models.length === 0 ? <option value="">No models available</option> : null}
            {!isLoadingModels
              ? models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))
              : null}
          </select>
        </>
      ) : null}
    </div>
  )
}
