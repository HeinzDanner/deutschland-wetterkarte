export async function registerObservationRoutes(app) {
  app.get('/api/observations/current', async (request, reply) => {
    const { stationId, lat, lon, includeStation } = request.query ?? {}
    const hasStationId = Boolean(stationId)
    const hasLatLon = lat !== undefined && lon !== undefined

    if (!hasStationId && !hasLatLon) {
      reply.code(400)
      return {
        data: null,
        errors: [
          {
            code: 'INVALID_QUERY',
            message: 'stationId oder lat+lon muss gesetzt sein.'
          }
        ]
      }
    }

    return {
      data: {
        locationId: hasStationId ? String(stationId) : `${lat},${lon}`,
        observedAt: new Date().toISOString(),
        source: 'planned-dwd',
        weatherCondition: {
          code: 'UNKNOWN',
          label: 'Noch nicht geladen'
        }
      },
      meta: { includeStation: includeStation === 'true' }
    }
  })
}
