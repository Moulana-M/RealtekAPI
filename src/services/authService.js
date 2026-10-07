import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { httpError } from '../utils/httpError.js'

const accounts = new Map()
const sessions = new Map()
const SESSION_DURATION = 8 * 60 * 60 * 1000

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64) }
}

function publicAccount(account) {
  return { id: account.id, username: account.username, role: account.role }
}

function seed(id, username, password, role) {
  accounts.set(id, { id, username, role, ...hashPassword(password) })
}

if (process.env.NODE_ENV === 'production') {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error('Production requires ADMIN_USERNAME and ADMIN_PASSWORD (at least 12 characters).')
  }
  seed('u-1', process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD, 'Admin')
} else {
  seed('u-1', 'Sheik Moulana', '12345', 'Admin')
  seed('u-2', 'John', 'john@123', 'Admin')
  seed('u-3', 'David', 'david@123', 'User')
}

export function signIn(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 128) {
    throw httpError(400, 'Username and password are required.')
  }
  const account = [...accounts.values()].find((item) => item.username.toLowerCase() === username.trim().toLowerCase())
  const candidate = hashPassword(password, account?.salt || 'unknown-account')
  if (!account || !timingSafeEqual(candidate.hash, account.hash)) throw httpError(401, 'Incorrect username or password.')
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(key)
  }
  sessions.set(token, { accountId: account.id, expiresAt: now + SESSION_DURATION })
  return { token, user: publicAccount(account) }
}

export function getSessionUser(token) {
  const session = sessions.get(token)
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token)
    throw httpError(401, 'Please log in to continue.')
  }
  const account = accounts.get(session.accountId)
  if (!account) throw httpError(401, 'Please log in to continue.')
  return publicAccount(account)
}

export function signOut(token) {
  sessions.delete(token)
}

export function listUsers() {
  return [...accounts.values()].map(publicAccount)
}

function validateUser(values, existing) {
  const username = typeof values.username === 'string' ? values.username.trim() : ''
  if (!/^[A-Za-z0-9 ._-]{3,50}$/.test(username)) throw httpError(400, 'Username must contain 3 to 50 letters, numbers, spaces, dots, underscores or hyphens.')
  if ([...accounts.values()].some((account) => account.id !== existing?.id && account.username.toLowerCase() === username.toLowerCase())) {
    throw httpError(409, 'This username already exists.')
  }
  if (!['Admin', 'User'].includes(values.role)) throw httpError(400, 'Invalid role.')
  const password = values.password
  if ((!existing || password) && (typeof password !== 'string' || password.length < 6 || password.length > 128)) {
    throw httpError(400, 'Password must contain 6 to 128 characters.')
  }
  return { username, role: values.role, ...(password ? hashPassword(password) : {}) }
}

export function createUser(values) {
  const account = { id: randomUUID(), ...validateUser(values) }
  accounts.set(account.id, account)
  return publicAccount(account)
}

function findUser(id) {
  const account = accounts.get(id)
  if (!account) throw httpError(404, 'User not found.')
  return account
}

function protectLastAdmin(account) {
  if (account.role === 'Admin' && [...accounts.values()].filter((item) => item.role === 'Admin').length === 1) {
    throw httpError(400, 'At least one administrator is required.')
  }
}

export function updateUser(id, values) {
  const existing = findUser(id)
  const changes = validateUser(values, existing)
  if (changes.role !== 'Admin') protectLastAdmin(existing)
  const account = { ...existing, ...changes }
  accounts.set(id, account)
  if (values.password) {
    for (const [token, session] of sessions) {
      if (session.accountId === id) sessions.delete(token)
    }
  }
  return publicAccount(account)
}

export function deleteUser(id, actorId) {
  if (id === actorId) throw httpError(400, 'You cannot delete your own account.')
  const account = findUser(id)
  protectLastAdmin(account)
  accounts.delete(id)
  for (const [token, session] of sessions) {
    if (session.accountId === id) sessions.delete(token)
  }
}