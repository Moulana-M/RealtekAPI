import { Pool, neonConfig } from '@neondatabase/serverless'
import { env } from '../config/env.js'

// WebSockets over port 443; the corporate network blocks Postgres port 5432.
neonConfig.webSocketConstructor = globalThis.WebSocket

export const pool = new Pool({ connectionString: env.databaseUrl })

// Without a listener, an idle-connection error crashes the whole API.
pool.on('error', (err) => console.error('Database pool error:', err.message))

export const query = (text, params) => pool.query(text, params)
