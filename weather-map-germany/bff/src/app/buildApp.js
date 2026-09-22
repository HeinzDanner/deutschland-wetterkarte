import Fastify from 'fastify'
import cors from '@fastify/cors'
import { registerRoutes } from '../routes/index.js'

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  app.get('/api/health', async () => ({
    data: { status: 'ok' },
    meta: { service: 'weather-map-germany-bff' }
  }))

  await registerRoutes(app)

  return app
}
