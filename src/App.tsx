import { useEffect, useRef, useState } from 'react'
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
import { fromLonLat } from 'ol/proj'
import { boundingExtent } from 'ol/extent'
import Polygon from 'ol/geom/Polygon'
import { apply as applyTransform } from 'ol/transform'
import type { FrameState } from 'ol/Map'
import germanyRings from './data/germany.json'
import { getEuropePrecipitationFrames, getRadarFrames, getSatelliteFrames, getStations, type WeatherStation } from './stations'
import { createRadarBuffer } from './radarBuffer'
import { StationForecast } from './StationForecast'
import './map.css'

const EUMETSAT_WMS_URL = 'https://view.eumetsat.int/geoserver/ows'
const SATELLITE_LAYER = 'msg_fes:ir108'
const EUROPE_PRECIPITATION_LAYER = 'msg_fes:h60b'
const EUROPE_FRAME_MS = 15 * 60 * 1000

// Maps a 5-minute radar time onto the 15-minute EUMETSAT slot that is already published.
function europeSlot(radarTime: string, frames: string[]) {
  if (frames.length === 0) return null
  const slot = new Date(Math.floor(Date.parse(radarTime) / EUROPE_FRAME_MS) * EUROPE_FRAME_MS).toISOString()
  if (slot < frames[0]) return frames[0]
  return slot > frames[frames.length - 1] ? frames[frames.length - 1] : slot
}
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
function clipLayerToGermany(layer: ImageLayer<ImageWMS>, outside: boolean, filter?: string) {
  layer.on('prerender', (event) => {
    const context = event.context as CanvasRenderingContext2D
    if (!event.frameState) return
    context.save()
    germanyClipPath(context, event.frameState, outside)
    if (filter) context.filter = filter
  })
  layer.on('postrender', (event) => {
    (event.context as CanvasRenderingContext2D).restore()
  })
}

function createGermanyMaskLayer() {
  const world = [[-20037508, -20037508], [-20037508, 20037508], [20037508, 20037508], [20037508, -20037508], [-20037508, -20037508]]
  const holes = (germanyRings as number[][][]).map((ring) => ring.map(([lon, lat]) => fromLonLat([lon, lat])))
  const border = holes.map((ring) => new Style({
    stroke: new Stroke({ color: '#0b1f33', width: 2 }),
    geometry: new Polygon([ring]),
  }))

  return new VectorLayer({
    source: new VectorSource({ features: [new Feature(new Polygon([world, ...holes]))] }),
    style: [
      new Style({ fill: new Fill({ color: 'rgba(30, 41, 54, 0.45)' }) }),
      ...border,
    ],
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  })
}

function App() {
  const mapElement = useRef<HTMLDivElement>(null)
  const map = useRef<Map | null>(null)
  const stationLayer = useRef<VectorLayer<Cluster<Feature<Point>>> | null>(null)
  const stationSource = useRef(new VectorSource<Feature<Point>>())
  const radarLayer = useRef<ImageLayer<ImageWMS> | null>(null)
  const radarBuffer = useRef<ReturnType<typeof createRadarBuffer> | null>(null)
  const satelliteLayer = useRef<ImageLayer<ImageWMS> | null>(null)
  const [satelliteVisible, setSatelliteVisible] = useState(false)
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.95)
  const [satelliteFrames, setSatelliteFrames] = useState<string[]>([])
  const [satelliteFrameIndex, setSatelliteFrameIndex] = useState(0)
  const [satelliteError, setSatelliteError] = useState<string | null>(null)
  const satelliteBuffer = useRef<ReturnType<typeof createRadarBuffer> | null>(null)
  const [satellitePlaying, setSatellitePlaying] = useState(false)
  const [satelliteImageLoading, setSatelliteImageLoading] = useState(false)
  const [satelliteImageError, setSatelliteImageError] = useState<string | null>(null)
  const [displayedSatelliteTime, setDisplayedSatelliteTime] = useState<string | null>(null)
  const europeLayer = useRef<ImageLayer<ImageWMS> | null>(null)
  const europeBuffer = useRef<ReturnType<typeof createRadarBuffer> | null>(null)
  const [europeFrames, setEuropeFrames] = useState<string[]>([])
  const [radarVisible, setRadarVisible] = useState(true)
  const [radarFrames, setRadarFrames] = useState<string[]>([])
  const [radarFrameIndex, setRadarFrameIndex] = useState(0)
  const [radarFramesLoading, setRadarFramesLoading] = useState(false)
  const [radarError, setRadarError] = useState<string | null>(null)
  const [radarPlaying, setRadarPlaying] = useState(false)
  const [radarImageLoading, setRadarImageLoading] = useState(false)
  const [radarImageError, setRadarImageError] = useState<string | null>(null)
  const [displayedRadarTime, setDisplayedRadarTime] = useState<string | null>(null)
  const [radarViewport, setRadarViewport] = useState(0)
  const [stationsVisible, setStationsVisible] = useState(false)
  const [stations, setStations] = useState<WeatherStation[]>([])
  const [radarReload, setRadarReload] = useState(0)
  const [satelliteReload, setSatelliteReload] = useState(0)
  const [stationError, setStationError] = useState<string | null>(null)
  const [stationWarning, setStationWarning] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<WeatherStation | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!mapElement.current) return

    const baseLayer = new TileLayer({
      source: new XYZ({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attributions: '&copy; OpenStreetMap contributors',
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
    europeLayer.current = new ImageLayer({
      opacity: 0.95,
      visible: false,
    })
    clipLayerToGermany(radarLayer.current, false)
    // The EUMETSAT palette is very pale, so boost its colours to stay readable on the map.
    clipLayerToGermany(europeLayer.current, true, 'saturate(2.6) contrast(1.5) brightness(0.85)')
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
      layers: [baseLayer, satelliteLayer.current, createGermanyMaskLayer(), europeLayer.current, radarLayer.current, stationLayer.current],
      view: new View({
        center: fromLonLat([10.5, 51.5]),
        zoom: 4.6,
        minZoom: 3.5,
        maxZoom: 12,
      }),
    })
    map.current.on('moveend', () => setRadarViewport((version) => version + 1))
    map.current.on('change:size', () => setRadarViewport((version) => version + 1))
    const updateClustering = () => {
      clusterSource.setDistance((map.current?.getView().getZoom() ?? 0) >= 8 ? 0 : 30)
    }
    map.current.getView().on('change:resolution', updateClustering)
    map.current.on('singleclick', (event) => {
      const feature = map.current?.forEachFeatureAtPixel(event.pixel, (mapFeature) => mapFeature)
      const members = feature?.get('features') as Feature<Point>[] | undefined
      if (members && members.length > 1) {
        const extent = boundingExtent(members.flatMap((member) => {
          const geometry = member.getGeometry()
          return geometry ? [geometry.getCoordinates()] : []
        }))
        map.current?.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 10, duration: 300 })
        setSelectedStation(null)
      } else {
        setSelectedStation((members?.[0].get('station') as WeatherStation | undefined) ?? null)
      }
    })
    setMapReady(true)

    return () => {
      map.current?.setTarget(undefined)
      map.current = null
      stationLayer.current = null
      radarLayer.current = null
      europeLayer.current = null
      satelliteLayer.current = null
      clusterSource.setSource(null)
    }
  }, [])

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
        setSatelliteError(error instanceof Error ? error.message : 'Unbekannter Fehler')
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

  const satelliteTime = satelliteFrames[satelliteFrameIndex]

  useEffect(() => {
    const layer = satelliteLayer.current
    const buffer = satelliteBuffer.current
    if (!satelliteVisible || !satelliteTime || !buffer || !layer) return
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
      setSatelliteImageLoading(false)
      setSatelliteImageError(error instanceof Error ? error.message : 'Satellitenbild konnte nicht geladen werden.')
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
  }, [satelliteFrames, satelliteFrameIndex, satelliteTime, satelliteVisible, radarViewport, satelliteReload])

  useEffect(() => {
    if (!satelliteVisible) satelliteLayer.current?.setVisible(false)
  }, [satelliteVisible])

  useEffect(() => {
    if (!satellitePlaying || satelliteFrames.length < 2 || satelliteImageLoading ||
      satelliteImageError || displayedSatelliteTime !== satelliteTime) return

    const timeout = window.setTimeout(() => {
      setSatelliteFrameIndex((index) => Math.min(index + 1, satelliteFrames.length - 1))
    }, 200)
    return () => window.clearTimeout(timeout)
  }, [satellitePlaying, satelliteFrames, satelliteImageLoading, satelliteImageError,
    displayedSatelliteTime, satelliteTime])

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
      getEuropePrecipitationFrames(controller.signal).then((data) => {
        if (isCurrent) setEuropeFrames(data.frames)
      }).catch((error: unknown) => {
        if (isCurrent && !controller.signal.aborted) console.warn('Europa-Niederschlag nicht verfügbar:', error)
      })
      try {
        const data = await getRadarFrames(controller.signal)
        if (!isCurrent) return
        setRadarFrames(data.frames)
        setRadarFrameIndex(data.frames.length - 1)
        setRadarError(null)
      } catch (error: unknown) {
        if (!isCurrent || controller.signal.aborted) return
        setRadarError(error instanceof Error ? error.message : 'Unbekannter Fehler')
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
    // The EUMETSAT image changes only every 15 minutes and is soft, so one pixel per screen pixel is enough.
    const europe = createRadarBuffer(
      EUMETSAT_WMS_URL, EUROPE_PRECIPITATION_LAYER, view.calculateExtent(size), resolution,
      1, view.getProjection(),
    )
    europeBuffer.current = europe
    return () => {
      buffer.dispose()
      europe.dispose()
      radarBuffer.current = null
      europeBuffer.current = null
    }
  }, [radarVisible, radarViewport, radarReload])

  const selectedRadarFrame = radarFrames[radarFrameIndex]

  useEffect(() => {
    const layer = europeLayer.current
    const buffer = europeBuffer.current
    const slot = selectedRadarFrame ? europeSlot(selectedRadarFrame, europeFrames) : null
    if (!radarVisible || !slot || !buffer || !layer) return
    buffer.retain(europeFrames)
    let active = true
    void buffer.load(slot, true).then((source) => {
      if (!active) return
      layer.setSource(source)
      layer.setVisible(true)
    }).catch((error: unknown) => {
      if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('Europa-Niederschlag konnte nicht geladen werden:', error)
      }
    })

    // Prefetch all slots of the timeline in playback order.
    const upcoming = radarFrames.map((_, offset) =>
      europeSlot(radarFrames[(radarFrameIndex + 1 + offset) % radarFrames.length], europeFrames))
    for (const next of new Set(upcoming)) {
      if (next && next !== slot) void buffer.load(next).catch(() => undefined)
    }

    return () => {
      active = false
    }
  }, [radarFrames, radarFrameIndex, selectedRadarFrame, europeFrames, radarVisible, radarViewport, radarReload])

  useEffect(() => {
    if (!radarVisible) europeLayer.current?.setVisible(false)
  }, [radarVisible])

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
      setRadarImageLoading(false)
      setRadarImageError(error instanceof Error ? error.message : 'Radarbild konnte nicht geladen werden.')
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
          ? `${data.unavailable.length} von ${data.total} Stationen momentan nicht verfügbar.`
          : null)
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        setStationError(error instanceof Error ? error.message : 'Unbekannter Fehler')
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
          <p className="eyebrow">Wetterkarte Deutschland</p>
          <h1>Wetter live im Überblick</h1>
        </div>
        <span className={`status ${mapReady ? 'status-ready' : ''}`}>
          <span className="status-dot" />
          {mapReady ? 'Karte bereit' : 'Karte wird geladen'}
        </span>
      </header>

      <section className="content">
        <aside className="control-panel">
          <div>
            <p className="panel-kicker">V1-Prototyp</p>
            <h2>Layer</h2>
          </div>
          <div className="layer-group">
            <p className="layer-group-title">Aktive Wetterdaten</p>
            <label className="layer-toggle">
              <input
                checked={radarVisible}
                onChange={(event) => setRadarVisible(event.target.checked)}
                type="checkbox"
              />
              <span className="toggle-track" />
              <span>
                <strong>Niederschlagsradar</strong>
                <small>DWD-Radar in Deutschland · EUMETSAT-Niederschlag in Europa</small>
              </span>
            </label>
            {radarVisible && (
              <>
                <div className="radar-timeline">
                  <div className="radar-time-heading">
                    <span>Beobachtung</span>
                    {displayedRadarTime ? (
                      <time dateTime={displayedRadarTime}>
                        {new Intl.DateTimeFormat('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Berlin',
                          timeZoneName: 'short',
                        }).format(new Date(displayedRadarTime))}
                      </time>
                    ) : (
                      <span>{radarFramesLoading ? 'Lade …' : 'Nicht verfügbar'}</span>
                    )}
                  </div>
                  {radarFrames.length > 0 && (
                    <>
                      <input
                        aria-label="Radarzeitpunkt auswählen"
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
                          aria-label="Fünf Minuten zurück"
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
                          {radarPlaying ? 'Pause' : 'Abspielen'}
                        </button>
                        <button
                          aria-label="Fünf Minuten vor"
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
                          Jetzt
                        </button>
                      </div>
                    </>
                  )}
                  {radarError && <p className="layer-error">{radarError}</p>}
                  {radarImageError && <p className="layer-error" role="alert">{radarImageError}</p>}
                  <button
                    className="reload-button"
                    disabled={radarFramesLoading}
                    onClick={() => setRadarReload((count) => count + 1)}
                    type="button"
                  >
                    ↻ Radar neu laden
                  </button>
                  <p
                    className={`radar-range-note radar-loading-status${radarImageLoading ? '' : ' radar-loading-status-idle'}`}
                    role="status"
                  >
                    Nächstes Radarbild wird vorgeladen …
                  </p>
                  <small className="radar-range-note">
                    {radarFrames.length > 0
                      ? `${radarFrames.length - 1} Schritte à 5 Minuten · letzte beobachtete Stunde`
                      : radarError ? 'Keine Radarzeitpunkte verfügbar' : 'DWD-Radarzeitpunkte werden geladen'}
                  </small>
                </div>
                <details className="radar-legend">
                  <summary>Farblegende anzeigen</summary>
                  <div className="radar-legend-content">
                    <img
                      alt="DWD-Legende der Niederschlagsrate in Millimetern pro Stunde"
                      src={RADAR_LEGEND_URL}
                    />
                    <p>
                      Die Flächenfarben zeigen die Niederschlagsrate in mm/h
                      (DWD-Radar, nur Deutschland). Außerhalb Deutschlands
                      zeigt die Karte einen aus Satellitendaten abgeleiteten
                      Niederschlag von EUMETSAT. Er ist gröber, ungenauer und
                      wird nur alle 15 Minuten aktualisiert.
                    </p>
                  </div>
                </details>
              </>
            )}
          </div>
          <div className="layer-group">
            <p className="layer-group-title">Wolken</p>
            <label className="layer-toggle">
              <input
                checked={satelliteVisible}
                onChange={(event) => setSatelliteVisible(event.target.checked)}
                type="checkbox"
              />
              <span className="toggle-track" />
              <span>
                <strong>Satellit Infrarot</strong>
                <small>EUMETSAT Meteosat · alle 15 Minuten</small>
              </span>
            </label>
            {satelliteVisible && (
              <div className="radar-timeline">
                <div className="radar-time-heading">
                  <span>Aufnahme</span>
                  {satelliteTime ? (
                    <time dateTime={satelliteTime}>
                      {new Intl.DateTimeFormat('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Europe/Berlin',
                        timeZoneName: 'short',
                      }).format(new Date(satelliteTime))}
                    </time>
                  ) : (
                    <span>{satelliteError ? 'Nicht verfügbar' : 'Lade …'}</span>
                  )}
                </div>
                {satelliteFrames.length > 0 && (
                  <>
                    <input
                      aria-label="Satellitenzeitpunkt auswählen"
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
                        aria-label="Eine Aufnahme zurück"
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
                        {satellitePlaying ? 'Pause' : 'Abspielen'}
                      </button>
                      <button
                        aria-label="Eine Aufnahme vor"
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
                        Jetzt
                      </button>
                    </div>
                  </>
                )}
                <label className="satellite-opacity">
                  <span>Deckkraft</span>
                  <input
                    aria-label="Deckkraft der Satellitenwolken"
                    max={1}
                    min={0.2}
                    onChange={(event) => setSatelliteOpacity(Number(event.target.value))}
                    step={0.05}
                    type="range"
                    value={satelliteOpacity}
                  />
                </label>
                {satelliteError && <p className="layer-error">{satelliteError}</p>}
                {satelliteImageError && <p className="layer-error" role="alert">{satelliteImageError}</p>}
                <button
                  className="reload-button"
                  onClick={() => setSatelliteReload((count) => count + 1)}
                  type="button"
                >
                  ↻ Satellit neu laden
                </button>
                <p
                  className={`radar-range-note radar-loading-status${satelliteImageLoading ? '' : ' radar-loading-status-idle'}`}
                  role="status"
                >
                  Satellitenbild wird geladen …
                </p>
                <small className="radar-range-note">
                  Helle Bereiche sind kalte, hohe Wolken; dunkle Flächen sind
                  Boden oder niedrige Wolken. Die Bilder sind etwa eine Stunde alt.
                </small>
              </div>
            )}
          </div>
          {selectedStation && (
            <section className="station-card" aria-live="polite">
              <button
                aria-label="Stationsdetails schließen"
                className="station-card-close"
                onClick={() => setSelectedStation(null)}
                type="button"
              >
                ×
              </button>
              <p className="panel-kicker">DWD-Wetterstation</p>
              <h3>{selectedStation.name}</h3>
              <p className="observed-label">Letzte Messung</p>
              <time className="observed-at" dateTime={selectedStation.observedAt}>
                {new Intl.DateTimeFormat('de-DE', {
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
                <div><dt>Temperatur</dt><dd>{selectedStation.temperature === null ? '–' : `${selectedStation.temperature.toFixed(1)} °C`}</dd></div>
                <div><dt>Feuchte</dt><dd>{selectedStation.humidity === null ? '–' : `${selectedStation.humidity} %`}</dd></div>
                <div><dt>Wind</dt><dd>{selectedStation.windSpeed === null ? '–' : `${selectedStation.windSpeed} km/h`}</dd></div>
              </dl>
              <StationForecast
                latitude={selectedStation.latitude}
                longitude={selectedStation.longitude}
              />
            </section>
          )}
          <div className="layer-group">
            <p className="layer-group-title">Messwerte</p>
            <label className="layer-toggle">
              <input
                checked={stationsVisible}
                onChange={(event) => setStationsVisible(event.target.checked)}
                type="checkbox"
              />
              <span className="toggle-track" />
              <span>
                <strong>Wetterstationen</strong>
                <small>
                  {stationError
                    ? 'Daten momentan nicht verfügbar'
                    : stationsVisible && stations.length === 0
                      ? 'DWD-Daten werden geladen'
                      : stations.length > 0
                        ? `${stations.length} Stationen aktiv · Deutschland`
                        : 'DWD-Netz · Deutschland'}
                </small>
              </span>
            </label>
            {stationError && <p className="layer-error">{stationError}</p>}
            {stationWarning && <p className="layer-error">{stationWarning}</p>}
            <p className="station-help">
              Gelbe, gestrichelte Kreise fassen mehrere Stationen zusammen und
              zeigen deren Durchschnittstemperatur (Ø).
              Anklicken oder hineinzoomen zeigt die einzelnen Messpunkte.
              Daten werden alle fünf Minuten nachgeladen.
            </p>
          </div>
          <div className="layer-group layer-group-muted">
            <p className="layer-group-title">In Vorbereitung</p>
            <div className="layer-placeholder">
              <span className="placeholder-icon">↗</span>
              <span>
                <strong>Hoch- und Tiefdruck</strong>
                <small>Großwetterlage · später</small>
              </span>
              <span className="planned-badge">V1.1</span>
            </div>
          </div>
          <div className="info-box">
            <strong>Hinweis</strong>
            <p>
              Die Basiskarte zeigt Europa als räumlichen Kontext. Der Radar-Layer
              zeigt in Deutschland das DWD-Radarkomposit, außerhalb
              abgeleiteten Satelliten-Niederschlag. Farbige Bereiche sind
              Niederschlag, nicht Wolken.
            </p>
          </div>
        </aside>
        <div ref={mapElement} className="map" aria-label="Deutschlandkarte mit DWD-Radar" />
      </section>
      <footer>
        Datenquelle: Deutscher Wetterdienst · Kartenbasis: OpenStreetMap
      </footer>
    </main>
  )
}

export default App
