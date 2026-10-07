import { getSessionUser } from '../services/authService.js'
import { httpError } from '../utils/httpError.js'

export const SESSION_COOKIE = 'realtech_session'
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api',
}

export function sessionToken(req) {
  return req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1)
}

export function requireSameOrigin(req, _res, next) {
  const origin = req.get('origin')
  if (origin) {
    let host
    try { host = new URL(origin).host } catch { throw httpError(403, 'Invalid request origin.') }
    if (host !== req.get('host')) throw httpError(403, 'Cross-origin changes are not allowed.')
  }
  next()
}

export function requireAuth(req, _res, next) {
  req.user = getSessionUser(sessionToken(req))
  next()
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'Admin') {
    throw httpError(403, req.method === 'POST' && req.baseUrl.endsWith('/upload-files')
      ? 'Only Admin users can upload files.'
      : 'Only Admin users can manage files and users.')
  }
  next()
}