/**
 * Parse .lino (Links Notation) files to extract model data
 * Uses the official links-notation parser
 */

import { Parser } from 'links-notation';

/**
 * Extract the deepest value from a link chain
 * @param {object} link - A Link object from the parser
 * @returns {string|Array} The deepest value(s)
 */
function getDeepestValue(link) {
  if (!link || !link.values || link.values.length === 0) {
    return link?.id || null;
  }

  // If it's a wrapper with a single value, unwrap it
  if (link.id === null && link.values.length === 1) {
    return getDeepestValue(link.values[0]);
  }

  // If it has multiple values, return them
  return link.values.map(v => getDeepestValue(v));
}

/**
 * Extract the field path from a nested link structure
 * @param {object} link - A Link object from the parser
 * @returns {Array<string>} Array of field names in the path
 */
function extractFieldPath(link) {
  const path = [];

  function collectIds(l) {
    if (!l) return;

    // Add non-null ids
    if (l.id !== null) {
      path.push(l.id);
    }

    // For values that are leaf nodes (no children), add their ids
    if (l.values && l.values.length > 0) {
      for (const v of l.values) {
        if (v.id !== null && (!v.values || v.values.length === 0)) {
          path.push(v.id);
        } else if (v.values && v.values.length > 0) {
          collectIds(v);
        }
      }
    }
  }

  collectIds(link);
  return path;
}

/**
 * Interpret parsed links into a model object
 * @param {Array} links - Parsed links from the official parser
 * @returns {object} Model data structure
 */
function interpretLinks(links) {
  const model = {};

  // Process links looking for hierarchical patterns
  for (const link of links) {
    // Pattern: ((model 'Name') (field1 field2 ...) ) (value)
    // This represents: model.field1.field2 = value
    if (link._isFromPathCombination && link.values && link.values.length === 2) {
      const [pathLink, valueLink] = link.values;
      const path = extractFieldPath(pathLink);
      const value = getDeepestValue(valueLink);

      // Interpret based on path structure
      // Skip the model name (first 2 elements: 'model' and actual name)
      if (path.length > 2) {
        const fieldPath = path.slice(2); // Remove 'model' and name from path

        // Set value in model based on field path
        if (fieldPath.length === 2 && fieldPath[0] === 'released' && fieldPath[1] === 'at') {
          model.releaseDate = value;
        } else if (fieldPath.length === 3 && fieldPath[0] === 'last' && fieldPath[1] === 'updated' && fieldPath[2] === 'at') {
          model.lastUpdated = value;
        } else if (fieldPath.length === 4 && fieldPath[0] === 'has' && fieldPath[1] === 'knowledge' && fieldPath[2] === 'cutoff' && fieldPath[3] === 'at') {
          model.knowledgeCutoff = value;
        } else if (fieldPath.length === 1 && fieldPath[0] === 'weights') {
          model.openWeights = value === 'open';
        } else if (fieldPath.length === 1 && fieldPath[0] === 'capabilities') {
          model.capabilities = Array.isArray(value) ? value : [value];
        } else if (fieldPath.length === 2 && fieldPath[0] === 'modalities') {
          if (!model.modalities) model.modalities = {};
          if (fieldPath[1] === 'input') {
            model.modalities.input = Array.isArray(value) ? value : [value];
          } else if (fieldPath[1] === 'output') {
            model.modalities.output = Array.isArray(value) ? value : [value];
          }
        } else if (fieldPath.length === 2 && fieldPath[0] === 'limits') {
          if (!model.limits) model.limits = {};
          if (fieldPath[1] === 'context') {
            const cleaned = typeof value === 'string' ? value.replace(/'/g, '').replace(/ /g, '') : value;
            model.limits.context = parseInt(cleaned);
          } else if (fieldPath[1] === 'output') {
            const cleaned = typeof value === 'string' ? value.replace(/'/g, '').replace(/ /g, '') : value;
            model.limits.output = parseInt(cleaned);
          }
        } else if (fieldPath.length === 2 && fieldPath[0] === 'costs') {
          if (!model.costs) model.costs = {};
          if (fieldPath[1] === 'input') {
            model.costs.input = parseFloat(value);
          } else if (fieldPath[1] === 'output') {
            model.costs.output = parseFloat(value);
          } else if (fieldPath[1] === 'cacheRead') {
            model.costs.cacheRead = parseFloat(value);
          } else if (fieldPath[1] === 'cacheWrite') {
            model.costs.cacheWrite = parseFloat(value);
          }
        }
      }
    }

    // Pattern: (model 'Name') - this is the model name
    else if (!link._isFromPathCombination && link.id === null && link.values && link.values.length === 2) {
      const [first, second] = link.values;
      if (first.id === 'model' && second.id) {
        model.name = second.id;
      }
    }
  }

  return model;
}

/**
 * Extract capabilities from content using line-based parsing
 * This is needed because multi-word capabilities on separate lines
 * are not properly preserved by the Links Notation parser
 * @param {string} content - The .lino file content
 * @returns {Array<string>|null} Array of capabilities or null if not found
 */
function extractCapabilitiesFromContent(content) {
  const lines = content.split('\n');
  let i = 0;

  // Find the capabilities section
  while (i < lines.length) {
    if (lines[i].trim() === 'capabilities') {
      i++;
      const capabilities = [];

      // Skip opening parenthesis
      if (i < lines.length && lines[i].trim() === '(') {
        i++;
      }

      // Read capabilities until closing parenthesis
      while (i < lines.length && lines[i].trim() !== ')') {
        const cap = lines[i].trim();
        if (cap) {
          capabilities.push(cap);
        }
        i++;
      }

      return capabilities;
    }
    i++;
  }

  return null;
}

/**
 * Parse a .lino file content into a structured object
 * @param {string} content - The .lino file content
 * @returns {object} Parsed model data
 */
export function parseLinoFile(content) {
  // Use the official Links Notation parser
  const parser = new Parser();
  const links = parser.parse(content);

  // Interpret the parsed links into our model structure
  const model = interpretLinks(links);

  // Override capabilities with line-based parsing to handle multi-word capabilities
  const capabilities = extractCapabilitiesFromContent(content);
  if (capabilities) {
    model.capabilities = capabilities;
  }

  return model;
}

/**
 * Load all model records from the generated browser catalog.
 * @returns {Promise<Array>} Array of normalized models
 */
export async function loadAllModels() {
  const response = await fetch(`${import.meta.env.BASE_URL || '/'}models.json`);

  if (!response.ok) {
    throw new Error(`Failed to load model catalog: ${response.status}`);
  }

  const catalog = await response.json();
  return Array.isArray(catalog.models) ? catalog.models : [];
}
