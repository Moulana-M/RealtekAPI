import { Router } from 'express'
import * as uploadFileController from '../controllers/uploadFileController.js'
import { uploadSingleFile } from '../middleware/upload.js'
import { requireAdmin, requireAuth, requireSameOrigin } from '../middleware/auth.js'
import { getFileSummary } from '../services/fileSummaryService.js'

const router = Router()
router.use(requireAuth)

router.get('/', uploadFileController.list)
router.get('/summary', async (_req, res) => res.json(await getFileSummary()))
router.get('/:id/download', uploadFileController.download)
router.get('/:id', uploadFileController.getById)
router.post('/', requireSameOrigin, requireAdmin, uploadSingleFile, uploadFileController.create)
router.put('/:id', requireSameOrigin, requireAdmin, uploadSingleFile, uploadFileController.update)
router.delete('/:id', requireSameOrigin, requireAdmin, uploadFileController.remove)

export default router
