export async function registerRadarRoutes(app) {
  app.get('/api/radar/layers', async () => ({
    data: [
      {
        id: 'dwd-radar-default',
        label: 'DWD Radar',
        serviceType: 'WMS',
        baseUrl: 'https://maps.dwd.de/geoserver/ows',
        layerName: 'dwd:RX-Produkt',
        defaultOpacity: 0.7,
        attribution: '© Deutscher Wetterdienst (DWD)',
        isVisibleByDefault: true
      }
    ],
    meta: { source: 'dwd' }
  }))
}
