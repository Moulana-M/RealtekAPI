import { httpError } from '../utils/httpError.js'

const TEXT_LIMITS = { countries: 50, state: 50, module_name: 50 }
const MODULE_NAMES = new Set(['purchasing-order', 'maintenance-order', 'request-order'])

export function validateModuleName(value) {
  if (typeof value !== 'string' || !MODULE_NAMES.has(value)) throw httpError(400, 'Invalid moduleName.')
  return value
}

export function parseId(value) {
  const id = Number(value)
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(id) || id < 1) throw httpError(400, 'Invalid id.')
  return id
}

// Clients send { moduleName, country, state, file: { filePath, fileName } } as a JSON "data" field.
function parsePayload(body = {}) {
  let data
  try {
    data = body.data === undefined ? {} : JSON.parse(body.data)
  } catch {
    throw httpError(400, 'data must be valid JSON.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'data must be a JSON object.')

  const input = { countries: data.country, state: data.state, module_name: data.moduleName }
  const fields = {}
  for (const [name, max] of Object.entries(TEXT_LIMITS)) {
    if (input[name] === undefined) continue
    const value = String(input[name]).trim()
    if (value.length > max) throw httpError(400, `${name} must be ${max} characters or fewer.`)
    fields[name] = value || null
  }
  if ('module_name' in fields && !fields.module_name) throw httpError(400, 'moduleName cannot be empty.')
  if ('module_name' in fields) validateModuleName(fields.module_name)
  return fields
}

export function validateCreate(req) {
  if (!req.file) throw httpError(400, 'A file is required.')
  const fields = parsePayload(req.body)
  if (!fields.module_name) throw httpError(400, 'moduleName is required.')
  return fields
}

export function validateUpdate(req) {
  const fields = parsePayload(req.body)
  if (!Object.keys(fields).length && !req.file) throw httpError(400, 'Nothing to update.')
  return fields
}
