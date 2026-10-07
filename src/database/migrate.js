import { pool, query } from './connection.js'

try {
  await query('ALTER TABLE "uploadFiles" ADD COLUMN IF NOT EXISTS file_name TEXT')
  console.log('Upload filename migration complete.')
} finally {
  await pool.end()
}