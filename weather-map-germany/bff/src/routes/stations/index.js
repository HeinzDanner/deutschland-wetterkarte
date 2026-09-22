export async function registerStationsRoutes(app) {
  app.get('/api/stations', async (request) => {
    const { bbox, zoom, limit, activeOnly } = request.query ?? {}

    return {
      data: [],
      meta: {
        filters: { bbox, zoom, limit, activeOnly },
        source: 'planned-dwd'
      }
    }
  })
}
