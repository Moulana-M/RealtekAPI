import multer from 'multer'
import { removeStoredFile } from '../utils/fileStorage.js'

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' })
}

export async function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)
  // A failed request must not leave its uploaded file behind.
  if (req.file) await removeStoredFile(req.file.filename)

  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message })
  if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found.' })
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message })
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
