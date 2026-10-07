import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { mock, test } from 'node:test'

process.env.DATABASE_URL ||= 'postgresql://unused:unused@localhost/unused'
const { env } = await import('../src/config/env.js')
const directory = await mkdtemp(path.join(os.tmpdir(), 'order-upload-api-'))
env.uploadDir = directory
const records = new Map()
let nextId = 1
mock.module('../src/models/uploadFileModel.js', {
  namedExports: {
    countByModule: async () => {
      const counts = new Map()
      for (const record of records.values()) {
        if (record.file_path?.trim()) counts.set(record.module_name, (counts.get(record.module_name) || 0) + 1)
      }
      return [...counts].map(([module_name, file_count]) => ({ module_name, file_count }))
    },
    findAll: async (moduleName) => [...records.values()].filter((record) => !moduleName || record.module_name === moduleName),
    findById: async (id) => records.get(id) || null,
    create: async (fields) => {
      const record = { id: nextId++, ...fields }
      records.set(record.id, record)
      return record
    },
    update: async (id, fields) => {
      const record = { ...records.get(id), ...fields }
      records.set(id, record)
      return record
    },
    remove: async (id) => {
      const record = records.get(id) || null
      records.delete(id)
      return record
    },
  },
})
const { default: app } = await import('../src/app.js')

test('order file APIs preserve filenames, isolate downloads, validate input and report missing files', async () => {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `https://realtekapi-4.onrender.com/api/upload-files`
  const apiUrl = `https://realtekapi-4.onrender.com/api`
  const adminLogin = await globalThis.fetch(`${apiUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'John', password: 'john@123' }),
  })
  assert.equal(adminLogin.status, 200)
  const cookie = adminLogin.headers.get('set-cookie').split(';')[0]
  const fetch = (url, options = {}) => globalThis.fetch(url, { ...options, headers: { ...options.headers, Cookie: cookie } })
  async function upload(moduleName, filename, content, method = 'POST', suffix = '') {
    const body = new FormData()
    body.append('data', JSON.stringify({ moduleName, country: 'India', state: 'Tamil Nadu' }))
    body.append('file', new Blob([content]), filename)
    return fetch(`${baseUrl}${suffix}`, { method, body })
  }
  try {
    const emptySummary = await fetch(`${baseUrl}/summary`).then((response) => response.json())
    assert.equal(emptySummary.totalFiles, 0)
    assert.deepEqual(emptySummary.modules.map((module) => module.fileCount), [0, 0, 0])
    const fixtures = [
      ['purchasing-order', 'purchase order.PDF', 'purchase content'],
      ['maintenance-order', 'maintenance.xlsx', 'maintenance content'],
      ['request-order', 'request-document.pdf', 'request content'],
    ]
    for (const [moduleName, filename, content] of fixtures) {
      const created = await upload(moduleName, filename, content)
      assert.equal(created.status, 201)
      const record = await created.json()
      assert.equal(record.file_name, filename)
      const list = await fetch(`${baseUrl}?moduleName=${moduleName}`).then((response) => response.json())
      assert.equal(list.length, 1)
      assert.equal(list[0].id, record.id)
      const metadata = await fetch(`${baseUrl}/${record.id}`).then((response) => response.json())
      assert.equal(metadata.file_name, filename)
      const download = await fetch(`${baseUrl}/${record.id}/download`)
      assert.equal(download.status, 200)
      assert.match(download.headers.get('content-disposition'), /attachment;/)
      assert.ok(download.headers.get('content-disposition').includes(`filename="${filename}"`))
      assert.equal(await download.text(), content)
    }
    const userLogin = await globalThis.fetch(`${apiUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'David', password: 'david@123', role: 'Admin' }),
    })
    assert.equal(userLogin.status, 200)
    assert.equal((await userLogin.json()).role, 'User')
    const userCookie = userLogin.headers.get('set-cookie').split(';')[0]
    const userFetch = (url, options = {}) => globalThis.fetch(url, { ...options, headers: { ...options.headers, Cookie: userCookie } })
    assert.equal((await userFetch(baseUrl)).status, 200)
    const populatedSummary = await userFetch(`${baseUrl}/summary`).then((response) => response.json())
    assert.equal(populatedSummary.totalFiles, 3)
    assert.deepEqual(populatedSummary.modules.map((module) => module.moduleName), fixtures.map(([moduleName]) => moduleName))
    assert.deepEqual(populatedSummary.modules.map((module) => module.fileCount), [1, 1, 1])
    assert.equal((await globalThis.fetch(`${baseUrl}/summary`)).status, 401)
    assert.equal((await userFetch(`${baseUrl}/1`)).status, 200)
    assert.equal(await userFetch(`${baseUrl}/1/download`).then((response) => response.text()), 'purchase content')
    for (const [moduleName] of fixtures) {
      const body = new FormData()
      body.append('data', JSON.stringify({ moduleName, role: 'Admin' }))
      body.append('file', new Blob(['unauthorized']), 'blocked.pdf')
      const denied = await userFetch(baseUrl, { method: 'POST', headers: { 'X-User-Role': 'Admin' }, body })
      assert.equal(denied.status, 403)
      assert.equal((await denied.json()).error, 'Only Admin users can upload files.')
    }
    for (const method of ['PUT', 'DELETE']) {
      assert.equal((await userFetch(`${baseUrl}/1`, { method })).status, 403)
    }
    assert.equal((await readdir(directory)).length, 3)
    assert.equal(records.size, 3)
    assert.equal((await globalThis.fetch(baseUrl)).status, 401)
    assert.equal((await globalThis.fetch(baseUrl, { method: 'POST', headers: { Cookie: 'realtech_session=forged', 'X-User-Role': 'Admin' }, body: new FormData() })).status, 401)
    assert.equal((await fetch(baseUrl, { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: new FormData() })).status, 403)
    const users = await userFetch(`${apiUrl}/users`).then((response) => response.json())
    assert.ok(users.every((user) => !('password' in user) && !('hash' in user)))
    assert.equal((await userFetch(`${apiUrl}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Forbidden', password: 'secret', role: 'Admin' }) })).status, 403)
    const managedResponse = await fetch(`${apiUrl}/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Managed account', password: 'managed-secret', role: 'Admin' }),
    })
    assert.equal(managedResponse.status, 201)
    const managed = await managedResponse.json()
    assert.deepEqual(Object.keys(managed).sort(), ['id', 'role', 'username'])
    const managedLogin = await globalThis.fetch(`${apiUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: managed.username, password: 'managed-secret' }),
    })
    assert.equal(managedLogin.status, 200)
    const managedCookie = managedLogin.headers.get('set-cookie').split(';')[0]
    assert.equal((await fetch(`${apiUrl}/users/${managed.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: managed.username, password: '', role: 'User' }),
    })).status, 200)
    const demoted = await globalThis.fetch(baseUrl, { method: 'POST', headers: { Cookie: managedCookie }, body: new FormData() })
    assert.equal(demoted.status, 403)
    assert.equal((await demoted.json()).error, 'Only Admin users can upload files.')
    assert.equal((await fetch(`${apiUrl}/users/${managed.id}`, { method: 'DELETE' })).status, 204)
    assert.equal((await globalThis.fetch(`${apiUrl}/auth/session`, { headers: { Cookie: managedCookie } })).status, 401)
    assert.equal((await userFetch(`${apiUrl}/auth/logout`, { method: 'POST' })).status, 204)
    assert.equal((await userFetch(baseUrl)).status, 401)

    const unicodeFilename = 'r\u00e9sum\u00e9.pdf'
    const unicodeUpload = await upload('request-order', unicodeFilename, 'unicode content')
    assert.equal(unicodeUpload.status, 201)
    const unicodeRecord = await unicodeUpload.json()
    assert.equal(unicodeRecord.file_name, unicodeFilename)
    const unicodeDownload = await fetch(`${baseUrl}/${unicodeRecord.id}/download`)
    const disposition = unicodeDownload.headers.get('content-disposition')
    assert.ok(disposition.includes(`filename="${unicodeFilename}"`) || disposition.includes(encodeURIComponent(unicodeFilename)))
    assert.equal(await unicodeDownload.text(), 'unicode content')
    await fetch(`${baseUrl}/${unicodeRecord.id}`, { method: 'DELETE' })

    const updated = await upload('purchasing-order', 'replacement.csv', 'replacement content', 'PUT', '/1')
    assert.equal(updated.status, 200)
    assert.equal((await updated.json()).file_name, 'replacement.csv')
    assert.equal(await fetch(`${baseUrl}/1/download`).then((response) => response.text()), 'replacement content')
    assert.equal((await readdir(directory)).length, 3)

    for (const id of ['0', 'invalid', '1e2', '9007199254740993']) {
      assert.equal((await fetch(`${baseUrl}/${id}/download`)).status, 400)
    }
    assert.equal((await fetch(`${baseUrl}/999/download`)).status, 404)
    assert.equal((await upload('request-order', 'bad.exe', 'bad')).status, 400)
    assert.equal((await upload('unknown-order', 'bad.pdf', 'bad')).status, 400)
    assert.equal((await upload('request-order', 'large.pdf', new Uint8Array(5 * 1024 * 1024 + 1))).status, 400)
    assert.equal((await fetch(`${baseUrl}?moduleName=unknown`)).status, 400)
    assert.equal((await fetch(baseUrl, { method: 'POST', body: new FormData() })).status, 400)
    assert.equal((await readdir(directory)).length, 3)

    records.set(4, { id: 4, module_name: 'request-order', file_path: null, file_name: null })
    const noFileSummary = await fetch(`${baseUrl}/summary`).then((response) => response.json())
    assert.equal(noFileSummary.totalFiles, 3)
    const noFile = await fetch(`${baseUrl}/4/download`)
    assert.equal(noFile.status, 404)
    assert.match((await noFile.json()).error, /No file/)
    await unlink(path.join(directory, path.basename(records.get(2).file_path)))
    const missing = await fetch(`${baseUrl}/2/download`)
    assert.equal(missing.status, 404)
    assert.equal((await missing.json()).error, 'File not found.')

    records.get(3).file_name = null
    const legacy = await fetch(`${baseUrl}/3/download`)
    assert.ok(legacy.headers.get('content-disposition').includes(path.basename(records.get(3).file_path)))
    assert.equal(await legacy.text(), 'request content')
    assert.equal((await fetch(`${baseUrl}/3`, { method: 'DELETE' })).status, 204)
    assert.equal((await fetch(`${baseUrl}/3/download`)).status, 404)
    const afterDeleteSummary = await fetch(`${baseUrl}/summary`).then((response) => response.json())
    assert.equal(afterDeleteSummary.totalFiles, 2)
    assert.deepEqual(afterDeleteSummary.modules.map((module) => module.fileCount), [1, 1, 0])
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})