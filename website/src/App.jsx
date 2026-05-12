import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  findModel,
  formatDate,
  formatInteger,
  formatPrice,
  loadModelCatalog,
  modelRoute,
  parseModelRoute,
  searchModels,
  sortModels,
} from './utils/modelCatalog'

const EMPTY_CATALOG = {
  providers: [],
  models: [],
  providerCount: 0,
  modelCount: 0,
}

function statusLabel(status) {
  if (!status || status === 'active') return 'Active'
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

function githubBlobUrl(sourcePath) {
  return `https://github.com/link-assistant/models/blob/main/${sourcePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}

function App() {
  const [catalog, setCatalog] = useState(EMPTY_CATALOG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [route, setRoute] = useState(() => parseModelRoute(window.location.hash))

  useEffect(() => {
    loadModelCatalog()
      .then((loadedCatalog) => {
        setCatalog(loadedCatalog)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error loading model catalog:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseModelRoute(window.location.hash))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const sortedModels = useMemo(() => sortModels(catalog.models), [catalog.models])
  const filteredModels = useMemo(
    () => searchModels(sortedModels, searchTerm),
    [sortedModels, searchTerm],
  )
  const selectedModel = useMemo(
    () => findModel(catalog.models, route),
    [catalog.models, route],
  )

  return (
    <div className="app">
      <header className="app-header">
        <a href="#" className="brand">
          <span className="brand-mark">LA</span>
          <span>
            <span className="brand-name">Models</span>
            <span className="brand-subtitle">AI model catalog</span>
          </span>
        </a>
        <a
          className="source-link"
          href="https://models.dev/api.json"
          target="_blank"
          rel="noopener noreferrer"
        >
          models.dev
        </a>
      </header>

      <main className="app-main">
        {loading && <StatusMessage>Loading model catalog...</StatusMessage>}
        {error && <StatusMessage tone="error">Error loading catalog: {error}</StatusMessage>}
        {!loading && !error && route && selectedModel && (
          <ModelDetail model={selectedModel} />
        )}
        {!loading && !error && route && !selectedModel && (
          <NotFound route={route} />
        )}
        {!loading && !error && !route && (
          <ModelList
            catalog={catalog}
            models={filteredModels}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
          />
        )}
      </main>
    </div>
  )
}

function StatusMessage({ children, tone = 'neutral' }) {
  return <div className={`status-message status-message--${tone}`}>{children}</div>
}

function ModelList({ catalog, models, searchTerm, onSearch }) {
  const deprecatedCount = catalog.models.filter((model) => model.status === 'deprecated').length
  const openWeightsCount = catalog.models.filter((model) => model.openWeights).length

  return (
    <>
      <section className="catalog-toolbar" aria-labelledby="catalog-title">
        <div>
          <p className="eyebrow">Live catalog</p>
          <h1 id="catalog-title">AI Models</h1>
        </div>
        <label className="search-field">
          <span className="visually-hidden">Search models</span>
          <input
            type="search"
            value={searchTerm}
            placeholder="Search by model, provider, family, modality, or capability"
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
      </section>

      <section className="summary-grid" aria-label="Catalog summary">
        <SummaryMetric label="Models" value={catalog.modelCount || catalog.models.length} />
        <SummaryMetric label="Providers" value={catalog.providerCount || catalog.providers.length} />
        <SummaryMetric label="Open weights" value={openWeightsCount} />
        <SummaryMetric label="Deprecated" value={deprecatedCount} tone="muted" />
      </section>

      <section className="table-section" aria-labelledby="models-table-title">
        <div className="table-heading">
          <h2 id="models-table-title">All Models</h2>
          <span>{models.length.toLocaleString()} shown</span>
        </div>
        {models.length === 0 ? (
          <StatusMessage>No models found</StatusMessage>
        ) : (
          <div className="table-scroll">
            <table className="model-table">
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Context</th>
                  <th scope="col">Input</th>
                  <th scope="col">Output</th>
                  <th scope="col">Capabilities</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <ModelRow key={model.key} model={model} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function SummaryMetric({ label, value, tone = 'default' }) {
  return (
    <div className={`summary-metric summary-metric--${tone}`}>
      <span>{label}</span>
      <strong>{Number(value).toLocaleString()}</strong>
    </div>
  )
}

function ModelRow({ model }) {
  return (
    <tr>
      <th scope="row">
        <a href={modelRoute(model)}>{model.name}</a>
        <span className="model-id">{model.id}</span>
      </th>
      <td>{model.providerName}</td>
      <td>{formatInteger(model.limits?.context)}</td>
      <td>{formatPrice(model.costs?.input)}</td>
      <td>{formatPrice(model.costs?.output)}</td>
      <td>
        <CapabilityBadges capabilities={model.capabilities} />
      </td>
      <td>{formatDate(model.lastUpdated || model.releaseDate)}</td>
      <td>
        <StatusBadge status={model.status} />
      </td>
    </tr>
  )
}

function CapabilityBadges({ capabilities }) {
  if (!capabilities?.length) return <span className="muted">None listed</span>

  return (
    <span className="badge-row">
      {capabilities.slice(0, 3).map((capability) => (
        <span className="badge" key={capability}>
          {capability}
        </span>
      ))}
      {capabilities.length > 3 && (
        <span className="badge badge--muted">+{capabilities.length - 3}</span>
      )}
    </span>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-badge--${status || 'active'}`}>
      {statusLabel(status || 'active')}
    </span>
  )
}

function ModelDetail({ model }) {
  return (
    <article className="detail-page">
      <a className="back-link" href="#">
        Back to models
      </a>

      <header className="detail-header">
        <div>
          <p className="eyebrow">{model.providerName}</p>
          <h1>{model.name}</h1>
          <p className="detail-id">{model.id}</p>
        </div>
        <StatusBadge status={model.status} />
      </header>

      <section className="detail-metrics" aria-label="Model summary">
        <DetailMetric label="Context" value={formatInteger(model.limits?.context)} />
        <DetailMetric label="Output" value={formatInteger(model.limits?.output)} />
        <DetailMetric label="Input / 1M" value={formatPrice(model.costs?.input)} />
        <DetailMetric label="Output / 1M" value={formatPrice(model.costs?.output)} />
      </section>

      <section className="detail-grid">
        <DetailSection title="Model">
          <DetailRow label="Provider" value={model.providerName} />
          <DetailRow label="Family" value={model.family || 'N/A'} />
          <DetailRow label="Release date" value={formatDate(model.releaseDate)} />
          <DetailRow label="Last updated" value={formatDate(model.lastUpdated)} />
          <DetailRow label="Knowledge cutoff" value={formatDate(model.knowledgeCutoff)} />
          <DetailRow label="Open weights" value={model.openWeights ? 'Yes' : 'No'} />
        </DetailSection>

        <DetailSection title="Modalities">
          <DetailRow label="Input" value={model.modalities?.input?.join(', ') || 'N/A'} />
          <DetailRow label="Output" value={model.modalities?.output?.join(', ') || 'N/A'} />
          <DetailRow
            label="Capabilities"
            value={model.capabilities?.join(', ') || 'None listed'}
          />
        </DetailSection>

        <DetailSection title="Pricing">
          <DetailRow label="Input" value={`${formatPrice(model.costs?.input)} / 1M tokens`} />
          <DetailRow label="Output" value={`${formatPrice(model.costs?.output)} / 1M tokens`} />
          <DetailRow
            label="Cache read"
            value={`${formatPrice(model.costs?.cacheRead)} / 1M tokens`}
          />
          <DetailRow
            label="Cache write"
            value={`${formatPrice(model.costs?.cacheWrite)} / 1M tokens`}
          />
        </DetailSection>

        <DetailSection title="Source">
          {model.providerDoc && (
            <DetailLink label="Provider docs" href={model.providerDoc} value={model.providerDoc} />
          )}
          <DetailLink
            label="Links Notation"
            href={githubBlobUrl(model.sourcePath)}
            value={model.sourcePath}
          />
        </DetailSection>
      </section>
    </article>
  )
}

function DetailMetric({ label, value }) {
  return (
    <div className="summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function DetailSection({ title, children }) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      <dl>{children}</dl>
    </section>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function DetailLink({ label, href, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      </dd>
    </div>
  )
}

function NotFound({ route }) {
  return (
    <section className="not-found">
      <a className="back-link" href="#">
        Back to models
      </a>
      <h1>Model not found</h1>
      <p>
        No catalog entry exists for {route.providerId} / {route.modelId}.
      </p>
    </section>
  )
}

export default App
