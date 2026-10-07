import path from 'node:path'
import * as uploadFileModel from '../models/uploadFileModel.js'
import { getStoredFilePath, removeStoredFile, toStoredPath } from '../utils/fileStorage.js'
import { httpError } from '../utils/httpError.js'

const fileColumns = (file) => ({
  file_path: toStoredPath(file.filename),
  file_name: path.win32.basename(path.posix.basename(file.originalname)),
  file_type: file.mimetype,
})

export const listUploadFiles = (moduleName) => uploadFileModel.findAll(moduleName)

export async function getUploadFile(id) {
  const uploadFile = await uploadFileModel.findById(id)
  if (!uploadFile) throw httpError(404, 'Upload not found.')
  return uploadFile
}

export async function getDownloadFile(id) {
  const record = await getUploadFile(id)
  const filePath = await getStoredFilePath(record.file_path)
  return { filePath, fileName: record.file_name || path.basename(filePath) }
}

export const createUploadFile = (fields, file) => uploadFileModel.create({ ...fields, ...fileColumns(file) })

export async function updateUploadFile(id, fields, file) {
  const existing = await getUploadFile(id)
  const updated = await uploadFileModel.update(id, file ? { ...fields, ...fileColumns(file) } : fields)
  if (file) await removeStoredFile(existing.file_path)
  return updated
}

export async function deleteUploadFile(id) {
  const deleted = await uploadFileModel.remove(id)
  if (!deleted) throw httpError(404, 'Upload not found.')
  await removeStoredFile(deleted.file_path)
}
