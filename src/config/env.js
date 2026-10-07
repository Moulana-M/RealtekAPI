import path from 'node:path'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set. Copy backend/.env.example to backend/.env and fill it in.`)
  return value
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl: required('DATABASE_URL'),
  uploadDir: path.resolve(import.meta.dirname, '../../uploads'),
}
