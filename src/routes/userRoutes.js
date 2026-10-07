import { Router } from 'express'
import { requireAdmin, requireAuth, requireSameOrigin } from '../middleware/auth.js'
import { createUser, deleteUser, listUsers, updateUser } from '../services/authService.js'

const router = Router()
router.use(requireAuth)
router.get('/', (_req, res) => res.json(listUsers()))
router.post('/', requireSameOrigin, requireAdmin, (req, res) => res.status(201).json(createUser(req.body || {})))
router.put('/:id', requireSameOrigin, requireAdmin, (req, res) => res.json(updateUser(req.params.id, req.body || {})))
router.delete('/:id', requireSameOrigin, requireAdmin, (req, res) => {
  deleteUser(req.params.id, req.user.id)
  res.status(204).end()
})
export default router