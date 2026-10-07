import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

process.env.DATABASE_URL ||= 'postgresql://unused:unused@localhost/unused'
const { env } = await import('../src/config/env.js')
const { getStoredFilePath } = await import('../src/utils/fileStorage.js')

test('stored file lookup isolates the requested file and rejects missing or unsafe paths', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'order-file-storage-'))
  const previousDirectory = env.uploadDir
  env.uploadDir = directory
  try {
    await writeFile(path.join(directory, 'first.pdf'), 'first file')
    await writeFile(path.join(directory, 'second.pdf'), 'second file')
    await mkdir(path.join(directory, 'folder.pdf'))
    assert.equal(await getStoredFilePath('uploads/first.pdf'), path.join(directory, 'first.pdf'))
    assert.equal(await getStoredFilePath('uploads/second.pdf'), path.join(directory, 'second.pdf'))
    for (const storedPath of [null, '', 'uploads/missing.pdf', '../first.pdf', 'uploads/../first.pdf', 'uploads/folder.pdf']) {
      await assert.rejects(getStoredFilePath(storedPath), { status: 404 })
    }
  } finally {
    env.uploadDir = previousDirectory
    await rm(directory, { recursive: true, force: true })
  }
})