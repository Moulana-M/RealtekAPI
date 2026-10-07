import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'

process.env.DATABASE_URL ||= 'postgresql://unused:unused@localhost/unused'
const { default: app } = await import('../src/app.js')
const { requireSameOrigin, cookieOptions } = await import('../src/middleware/auth.js')
const { createUser, deleteUser } = await import('../src/services/authService.js')

test('CORS preflight allows the deployed frontend and excludes untrusted origins', async () => {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    for (const origin of ['https://realtek-five.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://untrusted.example', 'https://realtekapi-4.onrender.com']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
      })
      assert.equal(response.status, 204)
      assert.equal(response.headers.get('access-control-allow-origin'), origin === 'https://untrusted.example' ? null : origin)
      if (origin !== 'https://untrusted.example' && origin !== 'https://realtekapi-4.onrender.com') {
        assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
        assert.ok(response.headers.get('access-control-allow-methods').includes('POST'))
        assert.ok(response.headers.get('access-control-allow-headers').includes('Content-Type'))
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('write requests accept the trusted frontend but reject other cross-origin sites', () => {
  const request = (origin) => ({ get: (header) => header === 'origin' ? origin : 'realtekapi-4.onrender.com' })
  let allowed = false
  requireSameOrigin(request('https://realtek-five.vercel.app'), {}, () => { allowed = true })
  assert.equal(allowed, true)
  assert.throws(() => requireSameOrigin(request('https://untrusted.example'), {}, () => {}), { status: 403 })
  assert.throws(() => requireSameOrigin(request('https://realtek-five.vercel.app.untrusted.example'), {}, () => {}), { status: 403 })
  assert.throws(() => requireSameOrigin(request('invalid'), {}, () => {}), { status: 403 })
})

test('session cookies use secure cross-site settings only in production', () => {
  assert.equal(cookieOptions.sameSite, process.env.NODE_ENV === 'production' ? 'none' : 'strict')
  assert.equal(cookieOptions.secure, process.env.NODE_ENV === 'production')
  assert.equal(cookieOptions.httpOnly, true)
})

test('the deployed frontend can log in, restore a session and log out', async () => {
  const user = createUser({ username: 'CORS test user', password: 'cors-test-password', role: 'User' })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const apiUrl = `http://127.0.0.1:${server.address().port}/api/auth`
  const origin = 'https://realtek-five.vercel.app'
  try {
    const login = await fetch(`${apiUrl}/login`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: 'cors-test-password' }),
    })
    assert.equal(login.status, 200)
    assert.equal(login.headers.get('access-control-allow-origin'), origin)
    const setCookie = login.headers.get('set-cookie')
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, process.env.NODE_ENV === 'production' ? /SameSite=None/ : /SameSite=Strict/)
    if (process.env.NODE_ENV === 'production') assert.match(setCookie, /; Secure/)
    const headers = { Origin: origin, Cookie: setCookie.split(';')[0] }
    const session = await fetch(`${apiUrl}/session`, { headers })
    assert.equal(session.status, 200)
    assert.deepEqual(await session.json(), user)
    const denied = await fetch(`${apiUrl}/logout`, { method: 'POST', headers: { ...headers, Origin: 'https://untrusted.example' } })
    assert.equal(denied.status, 403)
    const logout = await fetch(`${apiUrl}/logout`, { method: 'POST', headers })
    assert.equal(logout.status, 204)
    assert.equal((await fetch(`${apiUrl}/session`, { headers })).status, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    deleteUser(user.id, 'u-1')
  }
})