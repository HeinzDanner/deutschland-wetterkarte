import Fastify from 'fastify'
import cors from '@fastify/cors'
import { registerRoutes } from '../routes/index.js'

export async function buildApp() {
  const app = Fastify({ logger: true })
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('CORS origin not allowed'), false)
    },
  })

  app.get('/api/health', async () => ({
    data: { status: 'ok' },
    meta: { service: 'weather-map-germany-bff' }
  }))

  await registerRoutes(app)

  return app
}
