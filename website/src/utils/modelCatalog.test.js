import { describe, expect, it } from 'vitest'
import {
  formatInteger,
  formatPrice,
  modelRoute,
  parseModelRoute,
  searchModels,
  sortModels,
} from './modelCatalog'

describe('modelCatalog utilities', () => {
  const models = [
    {
      id: 'provider/model-a',
      name: 'Model A',
      providerId: 'provider-one',
      providerName: 'Provider One',
      releaseDate: '2024-01-01',
      capabilities: ['tool calls'],
      modalities: { input: ['text'], output: ['text'] },
    },
    {
      id: 'model-b',
      name: 'Model B',
      providerId: 'provider-two',
      providerName: 'Provider Two',
      releaseDate: '2025-01-01',
      capabilities: ['reasoning'],
      modalities: { input: ['image'], output: ['text'] },
    },
  ]

  it('builds and parses model hash routes with encoded model ids', () => {
    const href = modelRoute(models[0])
    expect(href).toBe('#/models/provider-one/provider%2Fmodel-a')
    expect(parseModelRoute(href)).toEqual({
      providerId: 'provider-one',
      modelId: 'provider/model-a',
    })
  })

  it('sorts models by release date descending', () => {
    expect(sortModels(models).map((model) => model.id)).toEqual(['model-b', 'provider/model-a'])
  })

  it('matches search terms across provider, capability, and modality fields', () => {
    expect(searchModels(models, 'provider two reasoning image')).toEqual([models[1]])
  })

  it('formats numbers and token prices for table display', () => {
    expect(formatInteger(200000)).toBe('200,000')
    expect(formatPrice(3)).toBe('$3.00')
    expect(formatPrice(0.15)).toBe('$0.15')
    expect(formatPrice(0.001)).toBe('$0.001')
  })
})
