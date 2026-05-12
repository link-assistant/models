#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_URL = 'https://models.dev/api.json'
const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)))
const DEFAULT_CATALOG_OUTPUT = 'website/public/models.json'
const DEFAULT_PROVIDERS_OUTPUT = 'providers'

function parseArgs(argv) {
  const options = {
    sourceUrl: SOURCE_URL,
    catalogOutput: DEFAULT_CATALOG_OUTPUT,
    providersOutput: DEFAULT_PROVIDERS_OUTPUT,
    input: null,
    check: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--check') {
      options.check = true
    } else if (arg === '--input') {
      options.input = argv[++index]
    } else if (arg === '--source-url') {
      options.sourceUrl = argv[++index]
    } else if (arg === '--catalog-output') {
      options.catalogOutput = argv[++index]
    } else if (arg === '--providers-output') {
      options.providersOutput = argv[++index]
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

async function readSourceCatalog(options) {
  if (options.input) {
    return JSON.parse(readFileSync(options.input, 'utf8'))
  }

  const response = await fetch(options.sourceUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to download ${options.sourceUrl}: ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}

function asArray(value) {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item !== null && item !== undefined).map(String)
}

function numberOrUndefined(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function cleanObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  )
}

function safePathSegment(value) {
  return encodeURIComponent(String(value))
}

function normalizeCatalog(sourceCatalog, sourceUrl = SOURCE_URL) {
  if (!sourceCatalog || typeof sourceCatalog !== 'object' || Array.isArray(sourceCatalog)) {
    throw new Error('models.dev catalog must be an object keyed by provider id')
  }

  const providers = []
  const models = []
  const providerEntries = Object.entries(sourceCatalog).sort(([left], [right]) =>
    left.localeCompare(right),
  )

  for (const [providerKey, providerRaw] of providerEntries) {
    const providerId = String(providerRaw.id || providerKey)
    const rawModels = providerRaw.models || {}
    const modelEntries = Object.entries(rawModels).sort(([left], [right]) =>
      left.localeCompare(right),
    )

    const provider = {
      id: providerId,
      name: String(providerRaw.name || providerId),
      api: providerRaw.api || null,
      doc: providerRaw.doc || null,
      npm: providerRaw.npm || null,
      env: asArray(providerRaw.env),
      modelCount: modelEntries.length,
    }

    providers.push(provider)

    for (const [modelKey, modelRaw] of modelEntries) {
      const modelId = String(modelRaw.id || modelKey)
      const sourcePath = [
        'providers',
        safePathSegment(provider.id),
        'models',
        `${safePathSegment(modelId)}.lino`,
      ].join('/')

      models.push({
        key: `${provider.id}:${modelId}`,
        id: modelId,
        name: String(modelRaw.name || modelId),
        providerId: provider.id,
        providerName: provider.name,
        providerDoc: provider.doc,
        upstreamProvider: modelRaw.provider || null,
        family: modelRaw.family || null,
        status: modelRaw.status || (modelRaw.experimental ? 'experimental' : 'active'),
        experimental: Boolean(modelRaw.experimental),
        releaseDate: modelRaw.release_date || null,
        lastUpdated: modelRaw.last_updated || null,
        knowledgeCutoff: modelRaw.knowledge || null,
        openWeights: Boolean(modelRaw.open_weights),
        capabilities: [
          modelRaw.reasoning ? 'reasoning' : null,
          modelRaw.tool_call ? 'tool calls' : null,
          modelRaw.temperature ? 'temperature' : null,
          modelRaw.attachment ? 'attachments' : null,
          modelRaw.structured_output ? 'structured output' : null,
          modelRaw.interleaved ? 'interleaved output' : null,
        ].filter(Boolean),
        modalities: {
          input: asArray(modelRaw.modalities?.input),
          output: asArray(modelRaw.modalities?.output),
        },
        limits: cleanObject({
          context: numberOrUndefined(modelRaw.limit?.context),
          input: numberOrUndefined(modelRaw.limit?.input),
          output: numberOrUndefined(modelRaw.limit?.output),
        }),
        costs: cleanObject({
          input: numberOrUndefined(modelRaw.cost?.input),
          output: numberOrUndefined(modelRaw.cost?.output),
          cacheRead: numberOrUndefined(modelRaw.cost?.cache_read),
          cacheWrite: numberOrUndefined(modelRaw.cost?.cache_write),
          contextOver200k: numberOrUndefined(modelRaw.cost?.context_over_200k),
          reasoning: numberOrUndefined(modelRaw.cost?.reasoning),
          inputAudio: numberOrUndefined(modelRaw.cost?.input_audio),
          outputAudio: numberOrUndefined(modelRaw.cost?.output_audio),
        }),
        sourcePath,
      })
    }
  }

  return {
    source: sourceUrl,
    schemaVersion: 1,
    providerCount: providers.length,
    modelCount: models.length,
    providers,
    models,
  }
}

function quoteLino(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

function formatLinoNumber(value) {
  if (!Number.isFinite(value)) return null

  if (Number.isInteger(value) && Math.abs(value) >= 10000) {
    return quoteLino(String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' '))
  }

  return String(value)
}

function addScalar(lines, indent, label, value, quoted = false) {
  if (value === null || value === undefined || value === '') return
  lines.push(`${indent}${label}`)
  lines.push(`${indent}  ${quoted ? quoteLino(value) : value}`)
}

function addList(lines, indent, label, values) {
  if (!values?.length) return

  lines.push(`${indent}${label}`)
  lines.push(`${indent}  (`)
  for (const value of values) {
    lines.push(`${indent}    ${value}`)
  }
  lines.push(`${indent}  )`)
}

function modelToLino(model) {
  const lines = [`model ${quoteLino(model.name)}`]

  addScalar(lines, '  ', 'has id', model.id, true)
  addScalar(lines, '  ', 'provider id', model.providerId, true)
  addScalar(lines, '  ', 'provided by', model.providerName, true)
  addScalar(lines, '  ', 'family', model.family, true)
  addScalar(lines, '  ', 'status', model.status)
  addScalar(lines, '  ', 'released at', model.releaseDate)
  addScalar(lines, '  ', 'last updated at', model.lastUpdated)
  addScalar(lines, '  ', 'has knowledge cutoff at', model.knowledgeCutoff)

  lines.push('  weights')
  lines.push(`    ${model.openWeights ? 'open' : 'closed'}`)

  addList(lines, '  ', 'capabilities', model.capabilities)

  if (model.modalities.input.length || model.modalities.output.length) {
    lines.push('  modalities')
    if (model.modalities.input.length) {
      lines.push('    input')
      lines.push(`      ${model.modalities.input.join(' ')}`)
    }
    if (model.modalities.output.length) {
      lines.push('    output')
      lines.push(`      ${model.modalities.output.join(' ')}`)
    }
  }

  const limitEntries = [
    ['context', model.limits.context],
    ['input', model.limits.input],
    ['output', model.limits.output],
  ].filter(([, value]) => value !== undefined)

  if (limitEntries.length) {
    lines.push('  limits')
    for (const [label, value] of limitEntries) {
      lines.push(`    ${label}`)
      lines.push(`      ${formatLinoNumber(value)}`)
    }
  }

  const costEntries = [
    ['input', model.costs.input],
    ['output', model.costs.output],
    ['cacheRead', model.costs.cacheRead],
    ['cacheWrite', model.costs.cacheWrite],
    ['contextOver200k', model.costs.contextOver200k],
    ['reasoning', model.costs.reasoning],
    ['inputAudio', model.costs.inputAudio],
    ['outputAudio', model.costs.outputAudio],
  ].filter(([, value]) => value !== undefined)

  if (costEntries.length) {
    lines.push('  costs')
    for (const [label, value] of costEntries) {
      lines.push(`    ${label}`)
      lines.push(`      ${formatLinoNumber(value)}`)
    }
  }

  return `${lines.join('\n')}\n`
}

function validateCatalog(catalog) {
  if (!Array.isArray(catalog.providers) || catalog.providers.length === 0) {
    throw new Error('Generated catalog has no providers')
  }

  if (!Array.isArray(catalog.models) || catalog.models.length === 0) {
    throw new Error('Generated catalog has no models')
  }

  const keys = new Set()
  for (const model of catalog.models) {
    for (const key of ['key', 'id', 'name', 'providerId', 'providerName', 'sourcePath']) {
      if (!model[key]) {
        throw new Error(`Generated model is missing ${key}: ${JSON.stringify(model)}`)
      }
    }

    if (keys.has(model.key)) {
      throw new Error(`Duplicate model key: ${model.key}`)
    }
    keys.add(model.key)
  }
}

function writeCatalog(catalog, options) {
  const catalogPath = join(ROOT_DIR, options.catalogOutput)
  const providersPath = join(ROOT_DIR, options.providersOutput)

  mkdirSync(dirname(catalogPath), { recursive: true })
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)

  rmSync(providersPath, { recursive: true, force: true })
  for (const model of catalog.models) {
    const modelPath = join(ROOT_DIR, model.sourcePath)
    mkdirSync(dirname(modelPath), { recursive: true })
    writeFileSync(modelPath, modelToLino(model))
  }
}

function checkGeneratedFiles(options) {
  const catalogPath = join(ROOT_DIR, options.catalogOutput)
  const providersPath = join(ROOT_DIR, options.providersOutput)
  if (!existsSync(catalogPath)) {
    throw new Error(`Missing generated catalog: ${options.catalogOutput}`)
  }

  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  validateCatalog(catalog)

  const missingFiles = []
  const staleFiles = []
  const expectedFiles = new Set()
  for (const model of catalog.models) {
    const modelPath = join(ROOT_DIR, model.sourcePath)
    expectedFiles.add(model.sourcePath)
    if (!existsSync(modelPath)) {
      missingFiles.push(model.sourcePath)
    } else if (readFileSync(modelPath, 'utf8') !== modelToLino(model)) {
      staleFiles.push(model.sourcePath)
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing ${missingFiles.length} generated .lino files. First missing file: ${missingFiles[0]}`,
    )
  }

  if (staleFiles.length > 0) {
    throw new Error(
      `Found ${staleFiles.length} stale .lino files. First stale file: ${staleFiles[0]}`,
    )
  }

  const extraFiles = listLinoFiles(providersPath)
    .map((path) => relative(ROOT_DIR, path).split('\\').join('/'))
    .filter((path) => !expectedFiles.has(path))

  if (extraFiles.length > 0) {
    throw new Error(
      `Found ${extraFiles.length} extra .lino files. First extra file: ${extraFiles[0]}`,
    )
  }

  console.log(
    `Validated ${catalog.modelCount} models across ${catalog.providerCount} providers.`,
  )
}

function listLinoFiles(directory) {
  if (!existsSync(directory)) return []

  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listLinoFiles(entryPath))
    } else if (entry.isFile() && entry.name.endsWith('.lino')) {
      files.push(entryPath)
    }
  }

  return files
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.check) {
    checkGeneratedFiles(options)
    return
  }

  const sourceCatalog = await readSourceCatalog(options)
  const catalog = normalizeCatalog(sourceCatalog, options.sourceUrl)
  validateCatalog(catalog)
  writeCatalog(catalog, options)

  console.log(
    `Generated ${catalog.modelCount} models across ${catalog.providerCount} providers.`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

export { modelToLino, normalizeCatalog }
