import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as modelCatalog from './utils/modelCatalog'

vi.mock('./utils/modelCatalog', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loadModelCatalog: vi.fn(),
  }
})

describe('App', () => {
  let consoleError

  const mockCatalog = {
    providerCount: 2,
    modelCount: 3,
    providers: [
      { id: 'anthropic', name: 'Anthropic', modelCount: 2 },
      { id: 'openai', name: 'OpenAI', modelCount: 1 },
    ],
    models: [
      {
        key: 'anthropic:claude-sonnet-4-5',
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        providerId: 'anthropic',
        providerName: 'Anthropic',
        providerDoc: 'https://docs.anthropic.com',
        family: 'claude-sonnet',
        status: 'active',
        releaseDate: '2025-09-29',
        lastUpdated: '2025-09-29',
        knowledgeCutoff: '2025-07-31',
        openWeights: false,
        capabilities: ['reasoning', 'tool calls', 'temperature'],
        modalities: { input: ['text', 'image'], output: ['text'] },
        limits: { context: 200000, output: 64000 },
        costs: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
        sourcePath: 'providers/anthropic/models/claude-sonnet-4-5.lino',
      },
      {
        key: 'anthropic:claude-haiku-4-5',
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        providerId: 'anthropic',
        providerName: 'Anthropic',
        status: 'active',
        releaseDate: '2025-10-01',
        lastUpdated: '2025-10-01',
        openWeights: false,
        capabilities: ['tool calls'],
        modalities: { input: ['text'], output: ['text'] },
        limits: { context: 200000, output: 64000 },
        costs: { input: 1, output: 5 },
        sourcePath: 'providers/anthropic/models/claude-haiku-4-5.lino',
      },
      {
        key: 'openai:gpt-4o-mini',
        id: 'gpt-4o-mini',
        name: 'GPT-4o mini',
        providerId: 'openai',
        providerName: 'OpenAI',
        status: 'deprecated',
        releaseDate: '2024-07-18',
        lastUpdated: '2025-01-01',
        openWeights: false,
        capabilities: ['structured output'],
        modalities: { input: ['text', 'image'], output: ['text'] },
        limits: { context: 128000, output: 16384 },
        costs: { input: 0.15, output: 0.6 },
        sourcePath: 'providers/openai/models/gpt-4o-mini.lino',
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.location.hash = ''
  })

  afterEach(() => {
    consoleError?.mockRestore()
  })

  it('shows a loading state while the catalog is loading', () => {
    modelCatalog.loadModelCatalog.mockReturnValue(new Promise(() => {}))
    render(<App />)
    expect(screen.getByText('Loading model catalog...')).toBeDefined()
  })

  it('renders the full model table by default', async () => {
    modelCatalog.loadModelCatalog.mockResolvedValue(mockCatalog)
    render(<App />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Claude Haiku 4.5')).toBeDefined()
    expect(within(table).getByText('Claude Sonnet 4.5')).toBeDefined()
    expect(within(table).getByText('GPT-4o mini')).toBeDefined()
    expect(screen.getByText('3 shown')).toBeDefined()
  })

  it('sorts models by newest release date first', async () => {
    modelCatalog.loadModelCatalog.mockResolvedValue(mockCatalog)
    render(<App />)

    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('Claude Haiku 4.5')).toBeDefined()
    expect(within(rows[2]).getByText('Claude Sonnet 4.5')).toBeDefined()
    expect(within(rows[3]).getByText('GPT-4o mini')).toBeDefined()
  })

  it('filters models by provider and capability text', async () => {
    const user = userEvent.setup()
    modelCatalog.loadModelCatalog.mockResolvedValue(mockCatalog)
    render(<App />)

    const searchInput = await screen.findByRole('searchbox')
    await user.type(searchInput, 'openai structured')

    await waitFor(() => {
      expect(screen.getByText('GPT-4o mini')).toBeDefined()
      expect(screen.queryByText('Claude Sonnet 4.5')).toBeNull()
      expect(screen.getByText('1 shown')).toBeDefined()
    })
  })

  it('shows an empty state when search has no matches', async () => {
    const user = userEvent.setup()
    modelCatalog.loadModelCatalog.mockResolvedValue(mockCatalog)
    render(<App />)

    const searchInput = await screen.findByRole('searchbox')
    await user.type(searchInput, 'nonexistent')

    expect(await screen.findByText('No models found')).toBeDefined()
  })

  it('opens a dedicated model detail page from the table', async () => {
    const user = userEvent.setup()
    modelCatalog.loadModelCatalog.mockResolvedValue(mockCatalog)
    render(<App />)

    await user.click(await screen.findByRole('link', { name: 'Claude Sonnet 4.5' }))

    expect(await screen.findByRole('heading', { name: 'Claude Sonnet 4.5', level: 1 }))
      .toBeDefined()
    expect(screen.getByText('claude-sonnet-4-5')).toBeDefined()
    expect(screen.getByText('claude-sonnet')).toBeDefined()
    expect(screen.getByText('text, image')).toBeDefined()
    expect(window.location.hash).toBe('#/models/anthropic/claude-sonnet-4-5')
  })

  it('can render a model detail page directly from the hash route', async () => {
    window.location.hash = '#/models/openai/gpt-4o-mini'
    modelCatalog.loadModelCatalog.mockResolvedValue(mockCatalog)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'GPT-4o mini', level: 1 }))
      .toBeDefined()
    expect(screen.getByText('Deprecated')).toBeDefined()
  })

  it('shows an error message when loading fails', async () => {
    const errorMessage = 'Failed to load models'
    modelCatalog.loadModelCatalog.mockRejectedValue(new Error(errorMessage))
    render(<App />)

    expect(await screen.findByText(`Error loading catalog: ${errorMessage}`)).toBeDefined()
  })
})
