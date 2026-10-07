import * as uploadFileService from '../services/uploadFileService.js'
import { parseId, validateCreate, validateModuleName, validateUpdate } from '../validators/uploadFileValidator.js'

export async function list(req, res) {
  const { moduleName } = req.query
  res.json(await uploadFileService.listUploadFiles(moduleName === undefined ? undefined : validateModuleName(moduleName)))
}

export async function getById(req, res) {
  res.json(await uploadFileService.getUploadFile(parseId(req.params.id)))
}

export async function download(req, res, next) {
  const { filePath, fileName } = await uploadFileService.getDownloadFile(parseId(req.params.id))
  res.set('X-Content-Type-Options', 'nosniff')
  res.download(filePath, fileName, (error) => {
    if (error) next(error)
  })
}

export async function create(req, res) {
  const fields = validateCreate(req)
  res.status(201).json(await uploadFileService.createUploadFile(fields, req.file))
}

export async function update(req, res) {
  const id = parseId(req.params.id)
  const fields = validateUpdate(req)
  res.json(await uploadFileService.updateUploadFile(id, fields, req.file))
}

export async function remove(req, res) {
  await uploadFileService.deleteUploadFile(parseId(req.params.id))
  res.status(204).end()
}
