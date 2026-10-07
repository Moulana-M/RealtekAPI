import { Router } from 'express'
import { cookieOptions, requireAuth, requireSameOrigin, SESSION_COOKIE, sessionToken } from '../middleware/auth.js'
import { signIn, signOut } from '../services/authService.js'

const router = Router()
const attempts = new Map()

router.post('/login', requireSameOrigin, (req, res) => {
  const now = Date.now()
  for (const [address, attempt] of attempts) {
    if (attempt.expiresAt <= now) attempts.delete(address)
  }
  const attempt = attempts.get(req.ip) || { count: 0, expiresAt: now + 15 * 60 * 1000 }
  if (attempt.count >= 20) return res.status(429).json({ error: 'Too many login attempts. Please try again later.' })
  attempt.count += 1
  attempts.set(req.ip, attempt)
  const { token, user } = signIn(req.body?.username, req.body?.password)
  attempts.delete(req.ip)
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 })
  res.json(user)
})

router.get('/session', requireAuth, (req, res) => res.json(req.user))
router.post('/logout', requireSameOrigin, (req, res) => {
  signOut(sessionToken(req))
  res.clearCookie(SESSION_COOKIE, cookieOptions)
  res.status(204).end()
})

export default router