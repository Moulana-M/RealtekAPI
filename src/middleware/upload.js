import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { env } from '../config/env.js'
import { httpError } from '../utils/httpError.js'

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg'])
const MAX_FILE_SIZE = 5 * 1024 * 1024

function decodeBrowserFilename(filename) {
  if (Array.from(filename).some((character) => character.codePointAt(0) > 255)) return filename
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(filename, 'latin1'))
  } catch {
    return filename
  }
}

mkdirSync(env.uploadDir, { recursive: true })

export const uploadSingleFile = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    file.originalname = decodeBrowserFilename(file.originalname)
    const hasControlCharacters = Array.from(file.originalname).some((character) => {
      const code = character.codePointAt(0)
      return code < 32 || code === 127
    })
    if (!file.originalname || file.originalname.length > 255 || hasControlCharacters) {
      return cb(httpError(400, 'Invalid file name. Use up to 255 characters without control characters.'))
    }
    if (ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) cb(null, true)
    else cb(httpError(400, `Unsupported file type. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`))
  },
}).single('file')
