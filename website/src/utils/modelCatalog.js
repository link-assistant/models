const CATALOG_FILE = 'models.json'

function baseUrl() {
  return import.meta.env.BASE_URL || '/'
}

export function catalogUrl() {
  return `${baseUrl()}${CATALOG_FILE}`
}

export async function loadModelCatalog() {
  const response = await fetch(catalogUrl())

  if (!response.ok) {
    throw new Error(`Failed to load model catalog: ${response.status}`)
  }

  return normalizeLoadedCatalog(await response.json())
}

export function normalizeLoadedCatalog(catalog) {
  return {
    ...catalog,
    providers: Array.isArray(catalog.providers) ? catalog.providers : [],
    models: Array.isArray(catalog.models) ? catalog.models : [],
  }
}

export function modelRoute(model) {
  return `#/models/${encodeURIComponent(model.providerId)}/${encodeURIComponent(model.id)}`
}

export function parseModelRoute(hash) {
  const match = hash.match(/^#\/models\/([^/]+)\/(.+)$/)
  if (!match) return null

  return {
    providerId: decodeURIComponent(match[1]),
    modelId: decodeURIComponent(match[2]),
  }
}

export function findModel(models, route) {
  if (!route) return null

  return models.find(
    (model) => model.providerId === route.providerId && model.id === route.modelId,
  )
}

export function sortModels(models) {
  return [...models].sort((left, right) => {
    const rightDate = Date.parse(right.releaseDate || '')
    const leftDate = Date.parse(left.releaseDate || '')

    if (!Number.isNaN(rightDate) || !Number.isNaN(leftDate)) {
      const dateDelta = (Number.isNaN(rightDate) ? 0 : rightDate) -
        (Number.isNaN(leftDate) ? 0 : leftDate)
      if (dateDelta !== 0) return dateDelta
    }

    const providerDelta = left.providerName.localeCompare(right.providerName)
    if (providerDelta !== 0) return providerDelta

    return left.name.localeCompare(right.name)
  })
}

export function searchModels(models, query) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (terms.length === 0) return models

  return models.filter((model) => {
    const index = [
      model.name,
      model.id,
      model.providerName,
      model.providerId,
      model.family,
      model.status,
      ...(model.capabilities || []),
      ...(model.modalities?.input || []),
      ...(model.modalities?.output || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return terms.every((term) => index.includes(term))
  })
}

export function formatInteger(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString()
    : 'N/A'
}

export function formatPrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A'
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1 ? 2 : 6,
  })}`
}

export function formatDate(value) {
  return value || 'N/A'
}
