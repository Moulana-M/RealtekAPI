import { realpath, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'
import { httpError } from './httpError.js'

export const toStoredPath = (filename) => `uploads/${filename}`

export async function getStoredFilePath(storedPath) {
  if (!storedPath) throw httpError(404, 'No file is available for this record.')
  const filename = path.basename(storedPath)
  if (storedPath !== toStoredPath(filename) || filename === '.' || filename === '..') {
    throw httpError(404, 'File not found.')
  }
  try {
    const directory = await realpath(env.uploadDir)
    const filePath = await realpath(path.join(directory, filename))
    if (path.dirname(filePath) !== directory || !(await stat(filePath)).isFile()) {
      throw httpError(404, 'File not found.')
    }
    return filePath
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') throw httpError(404, 'File not found.')
    throw error
  }
}

export async function removeStoredFile(storedPath) {
  if (!storedPath) return
  try {
    // basename() keeps deletes inside the upload folder even if a stored path was tampered with.
    await unlink(path.join(env.uploadDir, path.basename(storedPath)))
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(err)
  }
}
