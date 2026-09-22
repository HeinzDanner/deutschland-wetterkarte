import { registerRadarRoutes } from './radar/index.js'
import { registerStationsRoutes } from './stations/index.js'
import { registerObservationRoutes } from './observations/index.js'

export async function registerRoutes(app) {
  await registerRadarRoutes(app)
  await registerStationsRoutes(app)
  await registerObservationRoutes(app)
}
