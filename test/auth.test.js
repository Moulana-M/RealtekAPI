import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createUser, deleteUser, getSessionUser, listUsers, signIn, signOut, updateUser } from '../src/services/authService.js'
import { requireAdmin } from '../src/middleware/auth.js'

test('server sessions resolve roles without exposing passwords and reflect role changes immediately', () => {
  const account = createUser({ username: 'Role test user', password: 'test-secret', role: 'User' })
  const { token } = signIn(account.username, 'test-secret')
  assert.deepEqual(Object.keys(account).sort(), ['id', 'role', 'username'])
  assert.equal(getSessionUser(token).role, 'User')
  assert.throws(() => requireAdmin({ user: getSessionUser(token), method: 'POST', baseUrl: 'https://realtekapi-4.onrender.com/api/upload-files' }, {}, () => {}), { status: 403, message: 'Only Admin users can upload files.' })
  updateUser(account.id, { username: account.username, role: 'Admin', password: '' })
  assert.equal(getSessionUser(token).role, 'Admin')
  let allowed = false
  requireAdmin({ user: getSessionUser(token) }, {}, () => { allowed = true })
  assert.equal(allowed, true)
  assert.ok(listUsers().every((user) => !('password' in user) && !('hash' in user) && !('salt' in user)))
  assert.throws(() => getSessionUser('forged-token'), { status: 401 })
  assert.throws(() => signIn(account.username, 'wrong-password'), { status: 401 })
  signOut(token)
  assert.throws(() => getSessionUser(token), { status: 401 })
  deleteUser(account.id, 'u-1')
})