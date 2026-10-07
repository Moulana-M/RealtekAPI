import { Router } from 'express'
import { query } from '../database/connection.js'
import uploadFileRoutes from './uploadFileRoutes.js'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'

const router = Router()

router.get('/health', async (_req, res) => {
  await query('SELECT 1')
  res.json({ status: 'ok', database: 'connected' })
})

router.use('/upload-files', uploadFileRoutes)
router.use('/auth', authRoutes)
router.use('/users', userRoutes)

export default router
