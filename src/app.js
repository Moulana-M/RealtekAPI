import express from 'express'
import cors from 'cors'
import { allowedOrigins } from './config/cors.js'
import routes from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()

app.disable('x-powered-by')
app.use(cors({
	origin: allowedOrigins,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

app.use('/api', routes)
app.use('/api', notFound)
app.use(errorHandler)

export default app
