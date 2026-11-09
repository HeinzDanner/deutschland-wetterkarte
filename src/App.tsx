import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Feature from 'ol/Feature'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import Point from 'ol/geom/Point'
import ImageLayer from 'ol/layer/Image'
import ImageWMS from 'ol/source/ImageWMS'
import VectorSource from 'ol/source/Vector'
import Cluster from 'ol/source/Cluster'
import { Circle, Fill, Stroke, Style, Text } from 'ol/style'
import XYZ from 'ol/source/XYZ'
import { fromLonLat, toLonLat } from 'ol/proj'
import { boundingExtent } from 'ol/extent'
import { apply as applyTransform } from 'ol/transform'
import type { FrameState } from 'ol/Map'
import germanyRings from './data/germany.json'
import { getRadarFrames, getSatelliteFrames, getStations, type WeatherStation } from './stations'
import { createRadarBuffer } from './radarBuffer'
import { StationForecast } from './StationForecast'
import { OperaRadar, type RadarStatus } from './OperaRadar'
import { commonFrameTimes } from './synchronizedTimeline'
import { retainedRadarIndex } from './radarTimeline'
import { WeatherWarnings } from './WeatherWarnings'
import { LocationSearch, type ForecastLocation } from './LocationSearch'
import { useLanguage } from './i18n'
import { LegalPages } from './LegalPages'
import { DEFAULT_VIEW, DEFAULT_LAYERS, MAP_VIEW_KEY, MAP_LAYERS_KEY, readPreference, savePreference, validView, validLayers } from './mapPreferences'
import './map.css'

const EUMETSAT_WMS_URL = 'https://view.eumetsat.int/geoserver/ows'
const SATELLITE_LAYER = 'msg_fes:ir108'
const DWD_RADAR_FALLBACK_ENABLED = false
const DWD_WMS_URL = 'https://maps.dwd.de/geoserver/ows'
const RADAR_LAYER = 'dwd:Niederschlagsradar'
const RADAR_LEGEND_URL =
  'https://maps.dwd.de/geoserver/ows?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image%2Fpng&width=20&height=20&layer=dwd%3ANiederschlagsradar'

function germanyClipPath(context: CanvasRenderingContext2D, frameState: FrameState, outside: boolean) {
  const ratio = frameState.pixelRatio
  context.beginPath()
  if (outside) context.rect(0, 0, context.canvas.width, context.canvas.height)
  for (const ring of germanyRings as number[][][]) {
    ring.forEach(([lon, lat], index) => {
      const [x, y] = applyTransform(frameState.coordinateToPixelTransform, fromLonLat([lon, lat]))
      if (index === 0) context.moveTo(x * ratio, y * ratio)
      else context.lineTo(x * ratio, y * ratio)
    })
    context.closePath()
  }
  context.clip(outside ? 'evenodd' : 'nonzero')
}

// Limits a layer to Germany (or to everything outside) by clipping the canvas while it renders.
function clipLayerToGermany(layer: ImageLayer<ImageWMS>, outside: boolean) {
  layer.on('prerender', (event) => {
    const context = event.context as CanvasRenderingContext2D
    if (!event.frameState) return
    context.save()
    germanyClipPath(context, event.frameState, outside)
  })
  layer.on('postrender', (event) => {
    (event.context as CanvasRenderingContext2D).restore()
  })
}

function App() {
  const [initialView] = useState(() => readPreference(MAP_VIEW_KEY, DEFAULT_VIEW, validView))
  const [initialLayers] = useState(() => readPreference(MAP_LAYERS_KEY, DEFAULT_LAYERS, validLayers))
  const [warningsVisible, setWarningsVisible] = useState(initialLayers.warnings)
  const { language, locale, t, setLanguage } = useLanguage()
  const localization = useRef({ locale, t })
  localization.current = { locale, t }
  const mapElement = useRef<HTMLDivElement>(null)
  const map = useRef<Map | null>(null)
  const stationLayer = useRef<VectorLayer<Cluster<Feature<Point>>> | null>(null)
  const stationSource = useRef(new VectorSource<Feature<Point>>())
  const radarLayer = useRef<ImageLayer<ImageWMS> | null>(null)
  const radarBuffer = useRef<ReturnType<typeof createRadarBuffer> | null>(null)
  const satelliteLayer = useRef<ImageLayer<ImageWMS> | null>(null)
  const [satelliteVisible, setSatelliteVisible] = useState(initialLayers.satellite)
  const [satelliteOpacity, setSatelliteOpacity] = useState(initialLayers.satelliteOpacity)
  const [satelliteFrames, setSatelliteFrames] = useState<string[]>([])
  const [satelliteFrameIndex, setSatelliteFrameIndex] = useState(0)
  const [satelliteError, setSatelliteError] = useState<string | null>(null)
  const satelliteBuffer = useRef<ReturnType<typeof createRadarBuffer> | null>(null)
  const [satellitePlaying, setSatellitePlaying] = useState(false)
  const [satelliteImageLoading, setSatelliteImageLoading] = useState(false)
  const [satelliteImageError, setSatelliteImageError] = useState<string | null>(null)
  const [displayedSatelliteTime, setDisplayedSatelliteTime] = useState<string | null>(null)
  const [radarVisible, setRadarVisible] = useState(false)
  const [operaVisible, setOperaVisible] = useState(initialLayers.opera)
  const [radarFrames, setRadarFrames] = useState<string[]>([])
  const [radarFrameIndex, setRadarFrameIndex] = useState(0)
  const [radarFramesLoading, setRadarFramesLoading] = useState(false)
  const [radarError, setRadarError] = useState<string | null>(null)
  const [radarPlaying, setRadarPlaying] = useState(false)
  const [radarImageLoading, setRadarImageLoading] = useState(false)
  const [radarImageError, setRadarImageError] = useState<string | null>(null)
  const [displayedRadarTime, setDisplayedRadarTime] = useState<string | null>(null)
  const [radarViewport, setRadarViewport] = useState(0)
  const [stationsVisible, setStationsVisible] = useState(initialLayers.stations)
  const [stations, setStations] = useState<WeatherStation[]>([])
  const [radarReload, setRadarReload] = useState(0)
  const [satelliteReload, setSatelliteReload] = useState(0)
  const [stationError, setStationError] = useState<string | null>(null)
  const [stationWarning, setStationWarning] = useState<{ unavailable: number; total: number } | null>(null)
  const [selectedStation, setSelectedStation] = useState<WeatherStation | null>(null)
  const [forecastLocation, setForecastLocation] = useState<ForecastLocation | null>(null)
  const [forecastIsMapPoint, setForecastIsMapPoint] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [synchronized, setSynchronized] = useState(false)
  const [syncPlaying, setSyncPlaying] = useState(false)
  const [syncSelected, setSyncSelected] = useState<string | null>(null)
  const [operaFrames, setOperaFrames] = useState<string[]>([])
  const [operaStatus, setOperaStatus] = useState<RadarStatus>({ time: null, ready: false, error: false })
  const commonTimes = useMemo(() => commonFrameTimes(operaFrames, satelliteFrames), [operaFrames, satelliteFrames])
  const syncIndex = commonTimes.length ? retainedRadarIndex(commonTimes, syncSelected ?? undefined) : -1
  const syncTime = commonTimes[syncIndex] ?? null
  const syncActive = synchronized && operaVisible && satelliteVisible

  useEffect(() => {
    if (!operaVisible || !satelliteVisible) {
      setSynchronized(false)
      setSyncPlaying(false)
    }
  }, [operaVisible, satelliteVisible])

  useEffect(() => {
    if (syncTime) setSyncSelected(syncTime)
  }, [syncTime])

  useEffect(() => {
    if (syncActive) setSatellitePlaying(false)
  }, [syncActive])

  const syncReady = !!syncTime && operaStatus.ready && Date.parse(operaStatus.time ?? '') === Date.parse(syncTime) &&
    !satelliteImageLoading && Date.parse(displayedSatelliteTime ?? '') === Date.parse(syncTime)
  const syncError = operaStatus.error || !!satelliteError || !!satelliteImageError
  useEffect(() => {
    if (syncError) setSyncPlaying(false)
    if (!syncActive || !syncPlaying || !syncReady || syncError || commonTimes.length < 2) return
    const timer = window.setTimeout(() => setSyncSelected(commonTimes[(syncIndex + 1) % commonTimes.length]), 500)
    return () => window.clearTimeout(timer)
  }, [syncActive, syncPlaying, syncReady, syncError, commonTimes, syncIndex])
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [mobileDetail, setMobileDetail] = useState<{ selector: string } | null>(null)
  const panelElement = useRef<HTMLElement>(null)
  const revealMobileDetails = useCallback((selector: string) => {
    if (!window.matchMedia('(max-width: 700px)').matches) return
    setMobilePanelOpen(true)
    setMobileDetail({ selector })
  }, [])

  useEffect(() => {
    if (!mobilePanelOpen || !mobileDetail) return
    const panel = panelElement.current
    const detail = panel?.querySelector<HTMLElement>(mobileDetail.selector)
    if (panel && detail) {
      panel.scrollTop += detail.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16
    }
  }, [mobilePanelOpen, mobileDetail])

  useEffect(() => {
    if (forecastLocation || selectedStation) revealMobileDetails('.station-card')
  }, [forecastLocation, selectedStation, revealMobileDetails])

  useEffect(() => {
    savePreference(MAP_LAYERS_KEY, {
      opera: operaVisible, satellite: satelliteVisible, stations: stationsVisible,
      warnings: warningsVisible, satelliteOpacity,
    })
  }, [operaVisible, satelliteVisible, stationsVisible, warningsVisible, satelliteOpacity])

  useEffect(() => {
    const currentMap = map.current
    if (!mapReady || !currentMap || !forecastLocation) return
    const marker = new VectorLayer({
      source: new VectorSource({
        features: [new Feature(new Point(fromLonLat([forecastLocation.longitude, forecastLocation.latitude])))],
      }),
      style: new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: '#23b4dc' }),
          stroke: new Stroke({ color: '#fff', width: 3 }),
        }),
      }),
      zIndex: 20,
    })
    currentMap.addLayer(marker)
    return () => { currentMap.removeLayer(marker) }
  }, [mapReady, forecastLocation])

  useEffect(() => {
    if (!mapElement.current) return

    const baseLayer = new TileLayer({
      source: new XYZ({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        attributionsCollapsible: false,
      }),
    })
    satelliteLayer.current = new ImageLayer({
      className: 'satellite-layer',
      opacity: 0.95,
      visible: false,
    })
    radarLayer.current = new ImageLayer({
      opacity: 0.72,
      visible: false,
    })
    clipLayerToGermany(radarLayer.current, false)
    const clusterSource = new Cluster({
      distance: 30,
      source: stationSource.current,
    })
    stationLayer.current = new VectorLayer({
      source: clusterSource,
      style: (feature, resolution) => {
        const members = feature.get('features') as Feature<Point>[]
        const station = members[0].get('station') as WeatherStation
        const grouped = members.length > 1
        const temperatures = members
          .map((member) => (member.get('station') as WeatherStation).temperature)
          .filter((value): value is number => value !== null)
        const average = temperatures.length > 0
          ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
          : null
        const shown = grouped ? average : station.temperature
        const temperature = shown === null ? '–' : `${grouped ? 'Ø' : ''}${Math.round(shown)}°`
        const overview = resolution > 2500

        return new Style({
          image: new Circle({
            fill: new Fill({ color: grouped ? '#ffd166' : '#ffffff' }),
            radius: (overview ? 11 : 14) + (grouped ? 4 : 0),
            stroke: new Stroke({
              color: grouped ? '#b45309' : '#0b1f33',
              width: 2,
              lineDash: grouped ? [4, 3] : undefined,
            }),
          }),
          text: new Text({
            fill: new Fill({ color: '#102a40' }),
            font: `700 ${overview ? 9 : 11}px system-ui`,
            offsetY: 1,
            stroke: new Stroke({ color: '#ffffff', width: 4 }),
            text: temperature,
          }),
        })
      },
    })

    map.current = new Map({
      target: mapElement.current,
      layers: [baseLayer, satelliteLayer.current, radarLayer.current, stationLayer.current],
      view: new View({
        center: fromLonLat(initialView.center),
        zoom: initialView.zoom,
        minZoom: 3.5,
        maxZoom: 12,
      }),
    })
    map.current.on('moveend', () => setRadarViewport((version) => version + 1))
    const saveView = () => {
      const view = map.current?.getView()
      const center = view?.getCenter()
      const zoom = view?.getZoom()
      if (!center || zoom === undefined) return
      const [longitude, latitude] = toLonLat(center)
      const preference = { center: [((longitude + 180) % 360 + 360) % 360 - 180, latitude], zoom }
      if (validView(preference)) savePreference(MAP_VIEW_KEY, preference)
    }
    map.current.on('moveend', saveView)
    map.current.on('change:size', () => setRadarViewport((version) => version + 1))
    const updateClustering = () => {
      clusterSource.setDistance((map.current?.getView().getZoom() ?? 0) >= 8 ? 0 : 30)
    }
    map.current.getView().on('change:resolution', updateClustering)
    map.current.on('singleclick', (event) => {
      const feature = map.current?.forEachFeatureAtPixel(event.pixel, (mapFeature) => mapFeature, {
        layerFilter: (layer) => layer === stationLayer.current,
      })
      const members = feature?.get('features') as Feature<Point>[] | undefined
      if (!members && map.current?.forEachFeatureAtPixel(event.pixel,
        (candidate) => candidate.get('warning') ? true : undefined)) return
      if (members && members.length > 1) {
        setForecastLocation(null)
        setForecastIsMapPoint(false)
        const extent = boundingExtent(members.flatMap((member) => {
          const geometry = member.getGeometry()
          return geometry ? [geometry.getCoordinates()] : []
        }))
        map.current?.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 10, duration: 300 })
        setSelectedStation(null)
      } else {
        const station = members?.[0].get('station') as WeatherStation | undefined
        setSelectedStation(station ?? null)
        if (station) {
          setForecastLocation(null)
          setForecastIsMapPoint(false)
        } else {
          const [longitude, latitude] = toLonLat(event.coordinate)
          if (latitude < -90 || latitude > 90) return
          const wrappedLongitude = ((longitude + 180) % 360 + 360) % 360 - 180
          setForecastLocation({
            name: '',
            latitude,
            longitude: wrappedLongitude,
          })
          setForecastIsMapPoint(true)
        }
      }
    })
    setMapReady(true)

    return () => {
      saveView()
      map.current?.setTarget(undefined)
      map.current = null
      stationLayer.current = null
      radarLayer.current = null
      satelliteLayer.current = null
      clusterSource.setSource(null)
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapElement.current) return
    const root = mapElement.current
    const labels = language === 'de'
      ? { zoomIn: 'Vergrößern', zoomOut: 'Verkleinern', attribution: 'Quellenangaben' }
      : { zoomIn: 'Zoom in', zoomOut: 'Zoom out', attribution: 'Attributions' }
    for (const [selector, label] of [['.ol-zoom-in', labels.zoomIn], ['.ol-zoom-out', labels.zoomOut]] as const) {
      const button = root.querySelector<HTMLButtonElement>(selector)
      button?.setAttribute('aria-label', label)
      button?.setAttribute('title', label)
    }
    const attributionButton = root.querySelector<HTMLButtonElement>('.ol-attribution button')
    attributionButton?.setAttribute('aria-label', labels.attribution)
    attributionButton?.setAttribute('title', labels.attribution)
  }, [mapReady, language])

  useEffect(() => {
    if (!satelliteVisible) {
      setSatellitePlaying(false)
      setDisplayedSatelliteTime(null)
      return
    }

    const controller = new AbortController()
    const refresh = async () => {
      try {
        const data = await getSatelliteFrames(controller.signal)
        setSatelliteFrames(data.frames)
        setSatelliteFrameIndex(data.frames.length - 1)
        setSatelliteError(null)
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        console.error('Failed to load satellite frames:', error)
        setSatelliteError(error instanceof Error ? error.message : localization.current.t('Unbekannter Fehler', 'Unknown error'))
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 15 * 60 * 1000)

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [satelliteVisible, satelliteReload])

  useEffect(() => {
    const currentMap = map.current
    if (!satelliteVisible || !currentMap) return
    const view = currentMap.getView()
    const resolution = view.getResolution()
    const size = currentMap.getSize()
    if (!resolution || !size) return
    // Clouds are soft and IR data is coarse, so a reduced, palette-based image loads much faster.
    const buffer = createRadarBuffer(
      EUMETSAT_WMS_URL, SATELLITE_LAYER, view.calculateExtent(size), resolution,
      0.6, view.getProjection(), { format: 'image/png8', maxParallel: 6 },
    )
    satelliteBuffer.current = buffer
    return () => {
      buffer.dispose()
      satelliteBuffer.current = null
    }
  }, [satelliteVisible, radarViewport, satelliteReload])

  const satelliteTime = syncActive
    ? satelliteFrames.find((frame) => Date.parse(frame) === Date.parse(syncTime ?? ''))
    : satelliteFrames[satelliteFrameIndex]

  useEffect(() => {
    const layer = satelliteLayer.current
    const buffer = satelliteBuffer.current
    if (!satelliteVisible || !satelliteTime || !buffer || !layer) {
      if (syncActive) layer?.setVisible(false)
      return
    }
    buffer.retain(satelliteFrames)
    setSatelliteImageLoading(true)
    setSatelliteImageError(null)
    let active = true
    void buffer.load(satelliteTime, true).then((source) => {
      if (!active) return
      layer.setSource(source)
      layer.setVisible(true)
      setDisplayedSatelliteTime(satelliteTime)
      setSatelliteImageLoading(false)
    }).catch((error: unknown) => {
      if (!active) return
      console.error('Failed to load satellite image:', error)
      setSatelliteImageLoading(false)
      setSatelliteImageError(error instanceof Error ? error.message : localization.current.t(
        'Satellitenbild konnte nicht geladen werden.',
        'Could not load satellite image.',
      ))
      setSatellitePlaying(false)
    })

    // Prefetch every frame in playback order (wrapping around).
    for (let offset = 1; offset < satelliteFrames.length; offset += 1) {
      const time = satelliteFrames[(satelliteFrameIndex + offset) % satelliteFrames.length]
      void buffer.load(time).catch(() => undefined)
    }

    return () => {
      active = false
    }
  }, [satelliteFrames, satelliteFrameIndex, satelliteTime, satelliteVisible, radarViewport, satelliteReload, syncActive])

  useEffect(() => {
    if (!satelliteVisible) satelliteLayer.current?.setVisible(false)
  }, [satelliteVisible])

  useEffect(() => {
    if (syncActive || !satellitePlaying || satelliteFrames.length < 2 || satelliteImageLoading ||
      satelliteImageError || displayedSatelliteTime !== satelliteTime) return

    const timeout = window.setTimeout(() => {
      setSatelliteFrameIndex((index) => Math.min(index + 1, satelliteFrames.length - 1))
    }, 200)
    return () => window.clearTimeout(timeout)
  }, [satellitePlaying, satelliteFrames, satelliteImageLoading, satelliteImageError,
    displayedSatelliteTime, satelliteTime, syncActive])

  useEffect(() => {
    if (satelliteFrameIndex === satelliteFrames.length - 1) setSatellitePlaying(false)
  }, [satelliteFrameIndex, satelliteFrames.length])
  useEffect(() => {
    satelliteLayer.current?.setOpacity(satelliteOpacity)
  }, [satelliteOpacity])

  useEffect(() => {
    radarLayer.current?.setVisible(radarVisible && displayedRadarTime !== null)
  }, [radarVisible, displayedRadarTime])

  useEffect(() => {
    if (!radarVisible) {
      setRadarPlaying(false)
      return
    }

    const controller = new AbortController()
    let isCurrent = true
    const refreshFrames = async () => {
      setRadarFramesLoading(true)
      try {
        const data = await getRadarFrames(controller.signal)
        if (!isCurrent) return
        setRadarFrames(data.frames)
        setRadarFrameIndex(data.frames.length - 1)
        setRadarError(null)
      } catch (error: unknown) {
        if (!isCurrent || controller.signal.aborted) return
        console.error('Failed to load radar frames:', error)
        setRadarError(error instanceof Error ? error.message : localization.current.t('Unbekannter Fehler', 'Unknown error'))
      } finally {
        if (isCurrent) setRadarFramesLoading(false)
      }
    }
    void refreshFrames()
    const refreshInterval = window.setInterval(() => void refreshFrames(), 5 * 60 * 1000)

    return () => {
      isCurrent = false
      controller.abort()
      window.clearInterval(refreshInterval)
    }
  }, [radarVisible, radarReload])

  useEffect(() => {
    const currentMap = map.current
    if (!radarVisible || !currentMap) return
    const view = currentMap.getView()
    const resolution = view.getResolution()
    const size = currentMap.getSize()
    if (!resolution || !size) return
    const buffer = createRadarBuffer(
      DWD_WMS_URL, RADAR_LAYER, view.calculateExtent(size), resolution,
      window.devicePixelRatio || 1, view.getProjection(),
    )
    radarBuffer.current = buffer
    return () => {
      buffer.dispose()
      radarBuffer.current = null
    }
  }, [radarVisible, radarViewport, radarReload])


  useEffect(() => {
    const selectedFrame = radarFrames[radarFrameIndex]
    const buffer = radarBuffer.current
    const layer = radarLayer.current
    if (!radarVisible || !selectedFrame || !buffer || !layer) return
    buffer.retain(radarFrames)
    setRadarImageLoading(true)
    setRadarImageError(null)
    let active = true
    void buffer.load(selectedFrame, true).then((source) => {
        if (!active) return
        layer.setSource(source)
        setDisplayedRadarTime(selectedFrame)
        setRadarImageLoading(false)
    }).catch((error: unknown) => {
      if (!active) return
      console.error('Failed to load radar image:', error)
      setRadarImageLoading(false)
      setRadarImageError(error instanceof Error ? error.message : localization.current.t(
        'Radarbild konnte nicht geladen werden.',
        'Could not load radar image.',
      ))
      setRadarPlaying(false)
    })

    // Prefetch every frame in playback order (wrapping around), so the first playback does not stall.
    const upcomingFrames = radarFrames.map((_, offset) =>
      radarFrames[(radarFrameIndex + 1 + offset) % radarFrames.length])
    for (const time of upcomingFrames) {
      void buffer.load(time).catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          console.warn('Radar-Vorladen fehlgeschlagen:', time, error)
        }
      })
    }

    return () => {
      active = false
    }
  }, [radarFrames, radarFrameIndex, radarVisible, radarViewport, radarReload])

  useEffect(() => {
    if (!radarPlaying || radarFrames.length < 2 || radarImageLoading ||
      radarImageError || displayedRadarTime !== radarFrames[radarFrameIndex]) return

    const interval = window.setTimeout(() => {
      setRadarFrameIndex((index) => Math.min(index + 1, radarFrames.length - 1))
    }, 200)
    return () => window.clearTimeout(interval)
  }, [radarPlaying, radarFrames, radarFrameIndex, radarImageLoading, radarImageError, displayedRadarTime])

  useEffect(() => {
    if (radarFrameIndex === radarFrames.length - 1) setRadarPlaying(false)
  }, [radarFrameIndex, radarFrames.length])

  useEffect(() => {
    stationLayer.current?.setVisible(stationsVisible)
    if (!stationsVisible) {
      setSelectedStation(null)
      return
    }

    const controller = new AbortController()
    const refresh = async () => {
      try {
        const data = await getStations(controller.signal)
        setStations(data.stations)
        setSelectedStation((selected) => selected
          ? data.stations.find((station) => station.id === selected.id) ?? null
          : null)
        setStationError(null)
        setStationWarning(data.unavailable.length > 0
          ? { unavailable: data.unavailable.length, total: data.total }
          : null)
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        console.error('Failed to load weather stations:', error)
        setStationError(error instanceof Error ? error.message : localization.current.t('Unbekannter Fehler', 'Unknown error'))
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 5 * 60 * 1000)

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [stationsVisible])

  useEffect(() => {
    const source = stationSource.current

    source.clear()
    source.addFeatures(stations.map((station) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([station.longitude, station.latitude])),
        station,
      })
      return feature
    }))
  }, [stations])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t('Wetterkarte Deutschland & Europa', 'Germany & Europe Weather Map')}</p>
          <h1>{t('Wetter live im Überblick', 'Live weather at a glance')}</h1>
        </div>
        <div className="topbar-actions">
          <div className="language-switch" role="group" aria-label={t('Sprache auswählen', 'Select language')}>
            <button
              aria-pressed={language === 'de'}
              onClick={() => setLanguage('de')}
              type="button"
            >
              Deutsch
            </button>
            <button
              aria-pressed={language === 'en'}
              onClick={() => setLanguage('en')}
              type="button"
            >
              English
            </button>
          </div>
          <span className={`status ${mapReady ? 'status-ready' : ''}`}>
            <span className="status-dot" />
            {mapReady ? t('Karte bereit', 'Map ready') : t('Karte wird geladen', 'Loading map')}
          </span>
        </div>
      </header>

      <section className={`content${mobilePanelOpen ? ' mobile-panel-open' : ''}`}>
        <div className="mobile-map-toolbar">
          <button type="button" aria-controls="weather-controls" aria-expanded={mobilePanelOpen}
            onClick={() => setMobilePanelOpen((open) => !open)}>
            {mobilePanelOpen ? t('Bedienfeld schließen', 'Close controls') : t('Suche & Layer', 'Search & layers')}
          </button>
        </div>
        <aside className="control-panel" id="weather-controls" ref={panelElement}
          aria-label={t('Suche, Layer und Wetterdetails', 'Search, layers and weather details')}>
          <div>
            <p className="panel-kicker">{t('V1-Prototyp', 'V1 prototype')}</p>
            <h2>{t('Layer', 'Layers')}</h2>
          </div>
          <LocationSearch onSelect={(place) => {
            setSelectedStation(null)
            setForecastLocation(place)
            setForecastIsMapPoint(false)
            map.current?.getView().animate({ center: fromLonLat([place.longitude, place.latitude]), zoom: 9, duration: 500 })
          }} />
          <button type="button" className="reload-button" onClick={() => {
            map.current?.getView().animate({
              center: fromLonLat(DEFAULT_VIEW.center), zoom: DEFAULT_VIEW.zoom, duration: 300,
            })
          }}>{t('Kartenansicht zurücksetzen', 'Reset map view')}</button>
          <OperaRadar
            synchronized={syncActive}
            synchronizedTime={syncTime}
            onFrames={setOperaFrames}
            onStatus={setOperaStatus}
            map={mapReady ? map.current : null}
            active={operaVisible}
            onChange={(active) => {
              setOperaVisible(active)
              if (active) {
                setRadarVisible(false)
              }
            }}
          />
          {DWD_RADAR_FALLBACK_ENABLED && <div className="layer-group">
            <p className="layer-group-title">{t('Aktive Wetterdaten', 'Live weather data')}</p>
            <label className="layer-toggle">
              <input
                checked={radarVisible}
                onChange={(event) => {
                  setRadarVisible(event.target.checked)
                  if (event.target.checked) {
                    setOperaVisible(false)
                  }
                }}
                type="checkbox"
              />
              <span className="toggle-track" />
              <span>
                <strong>{t('Niederschlagsradar (Deutschland)', 'Precipitation radar (Germany)')}</strong>
                <small>{t('DWD-Radarmessungen · alle 5 Minuten', 'DWD radar measurements · every 5 minutes')}</small>
              </span>
            </label>
            {radarVisible && (
              <>
                <div className="radar-timeline">
                  <div className="radar-time-heading">
                    <span>{t('Beobachtung', 'Observation')}</span>
                    {displayedRadarTime ? (
                      <time dateTime={displayedRadarTime}>
                        {new Intl.DateTimeFormat(locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Berlin',
                          timeZoneName: 'short',
                        }).format(new Date(displayedRadarTime))}
                      </time>
                    ) : (
                      <span>{radarFramesLoading ? t('Lade …', 'Loading …') : t('Nicht verfügbar', 'Unavailable')}</span>
                    )}
                  </div>
                  {radarFrames.length > 0 && (
                    <>
                      <input
                        aria-label={t('Radarzeitpunkt auswählen', 'Select radar time')}
                        className="radar-slider"
                        max={radarFrames.length - 1}
                        min={0}
                        onChange={(event) => {
                          setRadarPlaying(false)
                          setRadarFrameIndex(Number(event.target.value))
                        }}
                        type="range"
                        value={radarFrameIndex}
                      />
                      <div className="radar-controls">
                        <button
                          aria-label={t('Fünf Minuten zurück', 'Back five minutes')}
                          disabled={radarFrameIndex === 0}
                          onClick={() => {
                            setRadarPlaying(false)
                            setRadarFrameIndex((index) => Math.max(0, index - 1))
                          }}
                          type="button"
                        >
                          −5
                        </button>
                        <button
                          onClick={() => {
                            if (radarPlaying) {
                              setRadarPlaying(false)
                            } else {
                              if (radarFrameIndex === radarFrames.length - 1) setRadarFrameIndex(0)
                              setRadarPlaying(true)
                            }
                          }}
                          type="button"
                        >
                          {radarPlaying ? t('Pause', 'Pause') : t('Abspielen', 'Play')}
                        </button>
                        <button
                          aria-label={t('Fünf Minuten vor', 'Forward five minutes')}
                          disabled={radarFrameIndex === radarFrames.length - 1}
                          onClick={() => {
                            setRadarPlaying(false)
                            setRadarFrameIndex((index) => Math.min(radarFrames.length - 1, index + 1))
                          }}
                          type="button"
                        >
                          +5
                        </button>
                        <button
                          disabled={radarFrameIndex === radarFrames.length - 1}
                          onClick={() => {
                            setRadarPlaying(false)
                            setRadarFrameIndex(radarFrames.length - 1)
                          }}
                          type="button"
                        >
                          {t('Jetzt', 'Now')}
                        </button>
                      </div>
                    </>
                  )}
                  {radarError && <p className="layer-error">{t('Radarzeitpunkte konnten nicht geladen werden.', 'Could not load radar timestamps.')}</p>}
                  {radarImageError && <p className="layer-error" role="alert">{t('Radarbild konnte nicht geladen werden.', 'Could not load radar image.')}</p>}
                  <button
                    className="reload-button"
                    disabled={radarFramesLoading}
                    onClick={() => setRadarReload((count) => count + 1)}
                    type="button"
                  >
                    ↻ {t('Radar neu laden', 'Reload radar')}
                  </button>
                  <p
                    className={`radar-range-note radar-loading-status${radarImageLoading ? '' : ' radar-loading-status-idle'}`}
                    role="status"
                  >
                    {t('Nächstes Radarbild wird vorgeladen …', 'Prefetching next radar image …')}
                  </p>
                  <small className="radar-range-note">
                    {radarFrames.length > 0
                      ? `${new Intl.NumberFormat(locale).format(radarFrames.length - 1)} ${t('Schritte à 5 Minuten · letzte beobachtete Stunde', 'steps at 5-minute intervals · latest observed hour')}`
                      : radarError ? t('Keine Radarzeitpunkte verfügbar', 'No radar timestamps available') : t('DWD-Radarzeitpunkte werden geladen', 'Loading DWD radar timestamps')}
                  </small>
                </div>
                <details className="radar-legend">
                  <summary>{t('Farblegende anzeigen', 'Show color legend')}</summary>
                  <div className="radar-legend-content">
                    <img
                      alt={t('DWD-Legende der Niederschlagsrate in Millimetern pro Stunde', 'DWD legend of precipitation rate in millimeters per hour')}
                      src={RADAR_LEGEND_URL}
                    />
                    <p>
                      {t(
                        'Die Flächenfarben zeigen die Niederschlagsrate in mm/h (DWD-Radar, nur Deutschland). Außerhalb Deutschlands werden in dieser Ansicht keine Niederschlagsdaten gezeigt.',
                        'Area colors show precipitation rate in mm/h (DWD radar, Germany only). No precipitation data is shown outside Germany in this view.',
                      )}
                    </p>
                  </div>
                </details>
              </>
            )}
          </div>}
          <div className="layer-group">
            <p className="layer-group-title">{t('Wolken', 'Clouds')}</p>
            <label className="layer-toggle">
              <input
                checked={satelliteVisible}
                onChange={(event) => setSatelliteVisible(event.target.checked)}
                type="checkbox"
              />
              <span className="toggle-track" />
              <span>
                <strong>{t('Satellit Infrarot', 'Infrared satellite')}</strong>
                <small>{t('EUMETSAT Meteosat · alle 15 Minuten', 'EUMETSAT Meteosat · every 15 minutes')}</small>
              </span>
            </label>
            {satelliteVisible && (
              <details className="radar-timeline" open={!syncActive}>
                <summary hidden={!syncActive}>{t('Satelliten-Details und Deckkraft', 'Satellite details and opacity')}</summary>
                <div className="radar-time-heading">
                  <span>{t('Aufnahme', 'Image')}</span>
                  {satelliteTime ? (
                    <time dateTime={satelliteTime}>
                      {new Intl.DateTimeFormat(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Europe/Berlin',
                        timeZoneName: 'short',
                      }).format(new Date(satelliteTime))}
                    </time>
                  ) : (
                    <span>{satelliteError ? t('Nicht verfügbar', 'Unavailable') : t('Lade …', 'Loading …')}</span>
                  )}
                </div>
                {satelliteFrames.length > 0 && !syncActive && (
                  <>
                    <input
                      aria-label={t('Satellitenzeitpunkt auswählen', 'Select satellite time')}
                      className="radar-slider"
                      max={satelliteFrames.length - 1}
                      min={0}
                      onChange={(event) => {
                        setSatellitePlaying(false)
                        setSatelliteFrameIndex(Number(event.target.value))
                      }}
                      type="range"
                      value={satelliteFrameIndex}
                    />
                    <div className="radar-controls">
                      <button
                        aria-label={t('Eine Aufnahme zurück', 'Previous image')}
                        disabled={satelliteFrameIndex === 0}
                        onClick={() => {
                          setSatellitePlaying(false)
                          setSatelliteFrameIndex((index) => Math.max(0, index - 1))
                        }}
                        type="button"
                      >
                        −15
                      </button>
                      <button
                        onClick={() => {
                          if (satellitePlaying) {
                            setSatellitePlaying(false)
                          } else {
                            if (satelliteFrameIndex === satelliteFrames.length - 1) setSatelliteFrameIndex(0)
                            setSatellitePlaying(true)
                          }
                        }}
                        type="button"
                      >
                        {satellitePlaying ? t('Pause', 'Pause') : t('Abspielen', 'Play')}
                      </button>
                      <button
                        aria-label={t('Eine Aufnahme vor', 'Next image')}
                        disabled={satelliteFrameIndex === satelliteFrames.length - 1}
                        onClick={() => {
                          setSatellitePlaying(false)
                          setSatelliteFrameIndex((index) => Math.min(satelliteFrames.length - 1, index + 1))
                        }}
                        type="button"
                      >
                        +15
                      </button>
                      <button
                        disabled={satelliteFrameIndex === satelliteFrames.length - 1}
                        onClick={() => {
                          setSatellitePlaying(false)
                          setSatelliteFrameIndex(satelliteFrames.length - 1)
                        }}
                        type="button"
                      >
                        {t('Jetzt', 'Now')}
                      </button>
                    </div>
                  </>
                )}
                <label className="satellite-opacity">
                  <span>{t('Deckkraft', 'Opacity')}</span>
                  <input
                    aria-label={t('Deckkraft der Satellitenwolken', 'Satellite cloud opacity')}
                    max={1}
                    min={0.2}
                    onChange={(event) => setSatelliteOpacity(Number(event.target.value))}
                    step={0.05}
                    type="range"
                    value={satelliteOpacity}
                  />
                </label>
                {satelliteError && <p className="layer-error">{t('Satellitendaten konnten nicht geladen werden.', 'Could not load satellite data.')}</p>}
                {satelliteImageError && <p className="layer-error" role="alert">{t('Satellitenbild konnte nicht geladen werden.', 'Could not load satellite image.')}</p>}
                <button
                  className="reload-button"
                  onClick={() => setSatelliteReload((count) => count + 1)}
                  type="button"
                >
                  ↻ {t('Satellit neu laden', 'Reload satellite')}
                </button>
                <p
                  className={`radar-range-note radar-loading-status${satelliteImageLoading ? '' : ' radar-loading-status-idle'}`}
                  role="status"
                >
                  {t('Satellitenbild wird geladen …', 'Loading satellite image …')}
                </p>
                <small className="radar-range-note">
                  {t(
                    'Helle Bereiche sind kalte, hohe Wolken; dunkle Flächen sind Boden oder niedrige Wolken. Die Bilder sind etwa eine Stunde alt.',
                    'Bright areas are cold, high clouds; dark areas are ground or low clouds. The images are about an hour old.',
                  )}
                </small>
              </details>
            )}
          </div>
          <div className="layer-group">
            <label className="layer-toggle">
              <input type="checkbox" checked={syncActive} onChange={(event) => {
                setSynchronized(event.target.checked)
                setSyncPlaying(false)
                if (event.target.checked) {
                  setOperaVisible(true)
                  setRadarVisible(false)
                  setSatelliteVisible(true)
                  setSyncSelected(null)
                }
              }} />
              <span className="toggle-track" />
              <span><strong>{t('Radar & Satellit synchron', 'Synchronize radar & satellite')}</strong>
                <small>{t('Gemeinsame Aufnahmezeitpunkte abspielen', 'Play matching image times')}</small></span>
            </label>
            {syncActive && <div className="radar-timeline">
              <p className="radar-range-note">{t('Nur gemeinsame Aufnahmezeiten; wegen der Satellitenverzögerung endet die Wiedergabe ggf. früher als das aktuelle Radar.', 'Only matching image times; satellite delays may make playback end earlier than the latest radar.')}</p>
              {syncTime ? <>
                <time dateTime={syncTime}>{new Intl.DateTimeFormat(locale, {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
                }).format(new Date(syncTime))}</time>
                <input type="range" className="radar-slider" aria-label={t('Gemeinsamen Zeitpunkt auswählen', 'Select synchronized time')}
                  min={0} max={commonTimes.length - 1} value={syncIndex} onChange={(event) => {
                    setSyncPlaying(false); setSyncSelected(commonTimes[Number(event.target.value)])
                  }} />
                <div className="radar-controls">
                  <button type="button" disabled={syncIndex === 0} onClick={() => {
                    setSyncPlaying(false); setSyncSelected(commonTimes[syncIndex - 1])
                  }}>{t('Zurück', 'Previous')}</button>
                  <button type="button" disabled={commonTimes.length < 2 || syncError} onClick={() => {
                    if (!syncPlaying && syncIndex === commonTimes.length - 1) setSyncSelected(commonTimes[0])
                    setSyncPlaying(!syncPlaying)
                  }}>{syncPlaying ? t('Pause', 'Pause') : t('Abspielen', 'Play')}</button>
                  <button type="button" disabled={syncIndex === commonTimes.length - 1} onClick={() => {
                    setSyncPlaying(false); setSyncSelected(commonTimes[syncIndex + 1])
                  }}>{t('Vor', 'Next')}</button>
                  <button type="button" onClick={() => {
                    setSyncPlaying(false); setSyncSelected(commonTimes[commonTimes.length - 1])
                  }}>{t('Neuestes gemeinsam', 'Latest matching')}</button>
                </div>
                <p className="radar-range-note" role="status">{syncError
                  ? t('Gemeinsame Wiedergabe wegen eines Ladefehlers pausiert. Betroffenen Layer erneut laden.', 'Synchronized playback paused after a loading error. Reload the affected layer.')
                  : syncReady ? t('Beide Bilder geladen.', 'Both images loaded.')
                    : t('Warte auf beide Bilder …', 'Waiting for both images …')}</p>
              </> : <p role="status">{t('Keine gemeinsamen Zeitpunkte verfügbar. Beide Zeitlisten müssen erfolgreich geladen sein.', 'No matching times available. Both timelines must load successfully.')}</p>}
            </div>}
          </div>
          {forecastLocation && (
            <section className="station-card" aria-label={t('Ortsvorhersage', 'Location forecast')}>
              <button aria-label={t('Ortsvorhersage schließen', 'Close location forecast')} className="station-card-close"
                onClick={() => {
                  setForecastLocation(null)
                  setForecastIsMapPoint(false)
                }} type="button">×</button>
              <p className="panel-kicker">{t('Ortsvorhersage', 'Location forecast')}</p>
              <h3>
                {forecastIsMapPoint
                  ? `${t('Kartenpunkt', 'Map point')} ${new Intl.NumberFormat(locale, {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  }).format(forecastLocation.latitude)}°, ${new Intl.NumberFormat(locale, {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  }).format(forecastLocation.longitude)}°`
                  : forecastLocation.name}
              </h3>
              <StationForecast key={`${forecastLocation.latitude},${forecastLocation.longitude}`}
                latitude={forecastLocation.latitude} longitude={forecastLocation.longitude} />
            </section>
          )}
          {selectedStation && (
            <section className="station-card" aria-live="polite">
              <button
                aria-label={t('Stationsdetails schließen', 'Close station details')}
                className="station-card-close"
                onClick={() => setSelectedStation(null)}
                type="button"
              >
                ×
              </button>
              <p className="panel-kicker">{t('DWD-Wetterstation', 'DWD weather station')}</p>
              <h3>{selectedStation.name}</h3>
              <p className="observed-label">{t('Letzte Messung', 'Latest observation')}</p>
              <time className="observed-at" dateTime={selectedStation.observedAt}>
                {new Intl.DateTimeFormat(locale, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Berlin',
                  timeZoneName: 'short',
                }).format(new Date(selectedStation.observedAt))}
              </time>
              <dl>
                <div><dt>{t('Temperatur', 'Temperature')}</dt><dd>{selectedStation.temperature === null ? '–' : `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(selectedStation.temperature)} °C`}</dd></div>
                <div><dt>{t('Feuchte', 'Humidity')}</dt><dd>{selectedStation.humidity === null ? '–' : `${new Intl.NumberFormat(locale).format(selectedStation.humidity)} %`}</dd></div>
                <div><dt>{t('Wind', 'Wind')}</dt><dd>{selectedStation.windSpeed === null ? '–' : `${new Intl.NumberFormat(locale).format(selectedStation.windSpeed)} km/h`}</dd></div>
              </dl>
              <StationForecast
                latitude={selectedStation.latitude}
                longitude={selectedStation.longitude}
              />
            </section>
          )}
          <div className="layer-group">
            <p className="layer-group-title">{t('Messwerte', 'Observations')}</p>
            <label className="layer-toggle">
              <input
                checked={stationsVisible}
                onChange={(event) => setStationsVisible(event.target.checked)}
                type="checkbox"
              />
              <span className="toggle-track" />
              <span>
                <strong>{t('Wetterstationen', 'Weather stations')}</strong>
                <small>
                  {stationError
                    ? t('Daten momentan nicht verfügbar', 'Data currently unavailable')
                    : stationsVisible && stations.length === 0
                      ? t('DWD-Daten werden geladen', 'Loading DWD data')
                      : stations.length > 0
                        ? `${new Intl.NumberFormat(locale).format(stations.length)} ${t('Stationen aktiv · Deutschland', 'stations active · Germany')}`
                        : t('DWD-Netz · Deutschland', 'DWD network · Germany')}
                </small>
              </span>
            </label>
            {stationError && <p className="layer-error">{t('Wetterstationsdaten konnten nicht geladen werden.', 'Could not load weather station data.')}</p>}
            {stationWarning && (
              <p className="layer-error">
                {new Intl.NumberFormat(locale).format(stationWarning.unavailable)} {t('von', 'of')}{' '}
                {new Intl.NumberFormat(locale).format(stationWarning.total)}{' '}
                {t('Stationen momentan nicht verfügbar.', 'stations currently unavailable.')}
              </p>
            )}
            <p className="station-help">
              {t(
                'Gelbe, gestrichelte Kreise fassen mehrere Stationen zusammen und zeigen deren Durchschnittstemperatur (Ø). Anklicken oder hineinzoomen zeigt die einzelnen Messpunkte. Daten werden alle fünf Minuten nachgeladen.',
                'Yellow, dashed circles group multiple stations and show their average temperature (Ø). Click or zoom in to see individual readings. Data is refreshed every five minutes.',
              )}
            </p>
          </div>
          <WeatherWarnings map={mapReady ? map.current : null} visible={warningsVisible} onChange={setWarningsVisible}
            onDetails={() => revealMobileDetails('.warning-card')} />
          <div className="info-box">
            <strong>{t('Hinweis', 'Note')}</strong>
            <p>
              {t(
                'OPERA zeigt einen gemeinsamen europäischen Radarverbund. Die Farbskala gilt einheitlich für Deutschland und Europa. Satellit Infrarot zeigt Wolken, nicht die Regenintensität.',
                'OPERA shows a shared European radar network. The color scale is consistent across Germany and Europe. Infrared satellite imagery shows clouds, not rainfall intensity.',
              )}
            </p>
          </div>
        </aside>
        <div ref={mapElement} className="map" aria-label={t('Wetterkarte Europa', 'Europe weather map')} />
      </section>
      <footer>
        <LegalPages />
        {t(
          'Datenquellen: EUMETNET OPERA (CC BY 4.0) · Deutscher Wetterdienst · EUMETSAT · Open-Meteo · Kartenbasis: OpenStreetMap',
          'Data sources: EUMETNET OPERA (CC BY 4.0) · Deutscher Wetterdienst · EUMETSAT · Open-Meteo · Map base: OpenStreetMap',
        )}
      </footer>
    </main>
  )
}

export default App
