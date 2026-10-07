import { query } from '../database/connection.js'

const COLUMNS = 'id, countries, state, file_path, file_name, file_type, module_name'

export async function countByModule() {
  const { rows } = await query(
    `SELECT module_name, COUNT(*)::int AS file_count FROM "uploadFiles"
     WHERE file_path IS NOT NULL AND BTRIM(file_path) <> '' GROUP BY module_name`,
  )
  return rows
}

export async function findAll(moduleName) {
  const { rows } = moduleName
    ? await query(`SELECT ${COLUMNS} FROM "uploadFiles" WHERE module_name = $1 ORDER BY id DESC`, [moduleName])
    : await query(`SELECT ${COLUMNS} FROM "uploadFiles" ORDER BY id DESC`)
  return rows
}

export async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM "uploadFiles" WHERE id = $1`, [id])
  return rows[0] ?? null
}

export async function create({ countries = null, state = null, file_path, file_name, file_type, module_name }) {
  const { rows } = await query(
    `INSERT INTO "uploadFiles" (countries, state, file_path, file_name, file_type, module_name)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [countries, state, file_path, file_name, file_type, module_name],
  )
  return rows[0]
}

// Callers must pass only whitelisted column names as keys; values are parameterized.
export async function update(id, changes) {
  const names = Object.keys(changes)
  const assignments = names.map((name, index) => `${name} = $${index + 2}`).join(', ')
  const { rows } = await query(
    `UPDATE "uploadFiles" SET ${assignments} WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, ...names.map((name) => changes[name])],
  )
  return rows[0] ?? null
}

export async function remove(id) {
  const { rows } = await query('DELETE FROM "uploadFiles" WHERE id = $1 RETURNING file_path', [id])
  return rows[0] ?? null
}
