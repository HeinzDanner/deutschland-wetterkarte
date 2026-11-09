import { useEffect, useRef, useState } from 'react'
import type OlMap from 'ol/Map'
import Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import MultiPolygon from 'ol/geom/MultiPolygon'
import GeoJSON from 'ol/format/GeoJSON'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Fill, Stroke, Style, Text } from 'ol/style'
import { unByKey } from 'ol/Observable'
import { useLanguage } from './i18n'
import { mergeWarningAreas } from './warningAreas'

type Warning = {
  identifier: string
  area: string
  headline: string
  description: string
  instruction: string
  event: string
  onset: string
  expires: string
  level: number
  altitude: number | null
  ceiling: number | null
}
type WarningFeature = Feature<Geometry>
const COLORS = ['#7a8a99', '#f4d03f', '#f39c12', '#e53935', '#9c27b0']
const hitStyle = new Style({ fill: new Fill({ color: 'rgba(0,0,0,0)' }) })

function warningStyles(label: string) {
  return COLORS.map((color, level) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 14
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Warngebiete: Canvas-Kontext nicht verfügbar.')
    context.fillStyle = `${color}12`
    context.fillRect(0, 0, 14, 14)
    context.strokeStyle = `${color}88`
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(-7, 14)
    context.lineTo(14, -7)
    context.moveTo(0, 21)
    context.lineTo(21, 0)
    context.stroke()
    const pattern = context.createPattern(canvas, 'repeat')
    if (!pattern) throw new Error('Warngebiete: Schraffur konnte nicht erstellt werden.')
    return [
      new Style({
        fill: new Fill({ color: pattern }),
        stroke: new Stroke({ color, width: 2.5, lineDash: [8, 4] }),
        zIndex: level,
      }),
      new Style({
        geometry: (feature) => {
          const polygons = (feature.getGeometry() as MultiPolygon).getPolygons()
          return polygons.reduce((largest, polygon) =>
            polygon.getArea() > largest.getArea() ? polygon : largest).getInteriorPoint()
        },
        text: new Text({
          text: `⚠ ${label} · ${level || '–'}`,
          font: 'bold 12px system-ui',
          fill: new Fill({ color: '#102a40' }),
          backgroundFill: new Fill({ color: '#fffffff0' }),
          backgroundStroke: new Stroke({ color, width: 2 }),
          padding: [5, 7, 5, 7],
          overflow: true,
        }),
        zIndex: 10 + level,
      }),
    ]
  })
}

export function WeatherWarnings({ map, visible, onChange, onDetails }: {
  map: OlMap | null
  visible: boolean
  onChange: (visible: boolean) => void
  onDetails: () => void
}) {
  const { t, locale } = useLanguage()
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [features, setFeatures] = useState<WarningFeature[]>([])
  const [selected, setSelected] = useState<Warning[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const layer = useRef<VectorLayer<VectorSource<WarningFeature>> | null>(null)
  const areasLayer = useRef<VectorLayer<VectorSource<WarningFeature>> | null>(null)
  const detailsCallback = useRef(onDetails)
  detailsCallback.current = onDetails
  const format = new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin', timeZoneName: 'short',
  })
  const levelName = (level: number) => [
    t('Unbekannt', 'Unknown'), t('Wetterwarnung', 'Weather warning'),
    t('Markantes Wetter', 'Significant weather'), t('Unwetter', 'Severe weather'),
    t('Extremes Unwetter', 'Extreme weather'),
  ][level] ?? t('Unbekannt', 'Unknown')
  const active = features.filter((feature) => Date.parse((feature.get('warning') as Warning).expires) > now)
  const count = new Set(active.map((feature) => (feature.get('warning') as Warning).identifier)).size

  useEffect(() => {
    if (!map || !visible) return
    const overlay = new VectorLayer({
      // DWD-Quellenvermerk-Regeln umgesetzt; keine abschließende rechtliche Freigabe.
      source: new VectorSource<WarningFeature>(),
      style: hitStyle,
      zIndex: 5,
    })
    const areas = new VectorLayer({
      source: new VectorSource<WarningFeature>(),
      zIndex: 6,
      declutter: true,
    })
    areasLayer.current = areas
    layer.current = overlay
    map.addLayer(overlay)
    map.addLayer(areas)
    const click = map.on('singleclick', (event) => {
      const station = map.forEachFeatureAtPixel(event.pixel, (feature) => feature.get('features') ? true : undefined)
      if (station) return
      const matches = new Map<string, Warning>()
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const warning = feature.get('warning') as Warning
        if (Date.parse(warning.expires) > Date.now()) matches.set(warning.identifier, warning)
      }, { layerFilter: (candidate) => candidate === overlay })
      setSelected([...matches.values()].sort((a, b) => b.level - a.level))
      if (matches.size) detailsCallback.current()
    })
    return () => {
      unByKey(click)
      map.removeLayer(overlay)
      map.removeLayer(areas)
      layer.current = null
      areasLayer.current = null
    }
  }, [map, visible])

  useEffect(() => {
    const styles = warningStyles(t('Wetterwarnung', 'Weather warning'))
    areasLayer.current?.setStyle((feature) => styles[feature.get('level') as number] ?? styles[0])
  }, [map, visible, t])

  useEffect(() => {
    layer.current?.getSource()?.clear()
    layer.current?.getSource()?.addFeatures(active)
  }, [features, now, map, visible])

  useEffect(() => {
    const source = areasLayer.current?.getSource()
    source?.clear()
    const current = features.filter((feature) => Date.parse((feature.get('warning') as Warning).expires) > now)
    if (!current.length || !source) return
    try {
      const format = new GeoJSON()
      const objects = current.map((feature) => ({
        geometry: format.writeGeometryObject(feature.getGeometry()!) as {
          type: string; coordinates: number[][][] | number[][][][]
        },
        properties: feature.get('warning') as Warning,
      }))
      const merged = mergeWarningAreas(objects)
      source.addFeatures(format.readFeatures({ type: 'FeatureCollection', features: merged }))
    } catch (reason) {
      console.error('DWD warning areas could not be merged:', reason)
      setError(true)
      layer.current?.getSource()?.clear()
      setSelected([])
    }
  }, [features, now, map, visible])

  useEffect(() => {
    setSelected([])
    if (!visible) return
    const controller = new AbortController()
    const refresh = async () => {
      setLoading(true)
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(65000)])
        const response = await fetch('/api/warnings', { signal })
        if (!response.ok) throw new Error(`DWD warnings: HTTP ${response.status}`)
        const data = await response.json() as { type: string; features: unknown[]; fetchedAt: string }
        const parsed = new GeoJSON().readFeatures(data, {
          dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857',
        })
        if (controller.signal.aborted) return
        for (const feature of parsed) {
          const warning = feature.getProperties()
          feature.set('warning', warning)
        }
        setFeatures(parsed)
        setFetchedAt(data.fetchedAt)
        setError(false)
        setNow(Date.now())
        setSelected((previous) => previous.flatMap((warning) => {
          const replacement = parsed.find((feature) => (feature.get('warning') as Warning).identifier === warning.identifier)
          return replacement ? [replacement.get('warning') as Warning] : []
        }))
      } catch (reason) {
        if (controller.signal.aborted) return
        console.warn('DWD warnings failed:', reason)
        setError(true)
        setFeatures([])
        setSelected([])
        setFetchedAt(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void refresh()
    const refreshTimer = window.setInterval(() => void refresh(), 5 * 60000)
    const expiryTimer = window.setInterval(() => {
      setNow(Date.now())
      setSelected((warnings) => warnings.filter((warning) => Date.parse(warning.expires) > Date.now()))
    }, 60000)
    return () => {
      controller.abort()
      window.clearInterval(refreshTimer)
      window.clearInterval(expiryTimer)
    }
  }, [visible, reload])

  return (
    <div className="layer-group">
      <p className="layer-group-title">{t('Wetterwarnungen', 'Weather warnings')}</p>
      <label className="layer-toggle">
        <input type="checkbox" checked={visible} onChange={(event) => onChange(event.target.checked)} />
        <span className="toggle-track" />
        <span><strong>{t('Warngebiete (Deutschland)', 'Warning areas (Germany)')}</strong>
          <small>{t('Eigene Darstellung · Originalwarntexte', 'Own presentation · original warning texts')}</small></span>
      </label>
      {visible && (
        <div className="warnings-panel">
          <p className="radar-range-note">{t(
            'Eigene Darstellung auf Basis von Wetterwarnungen; kein amtlicher Warnkanal. Vollständigkeit und Aktualität sind nicht gewährleistet. Maßgeblich sind die ',
            'Own presentation based on weather warnings; not an official alert channel. Completeness and timeliness are not guaranteed. Please refer to the ',
          )}<a href="https://www.dwd.de/warnungen" target="_blank" rel="noreferrer">{t('offiziellen Warnungen', 'official warnings')}</a>
            {t(' des Deutschen Wetterdienstes.', ' issued by Deutscher Wetterdienst.')}</p>
          <p className="radar-range-note">{t('Schraffierte Flächen mit gestricheltem Rand und „Wetterwarnung“ kennzeichnen aufbereitete Warngebiete, nicht die Regenintensität.', 'Hatched areas with dashed outlines and “Weather warning” labels indicate processed warning areas, not rainfall intensity.')}</p>
          {loading && <p role="status">{t('Warnungen werden geladen …', 'Loading warnings …')}</p>}
          {error && <p className="layer-error" role="alert">{t('Warnungen nicht verfügbar. Daraus lässt sich keine Warnfreiheit ableiten.', 'Warnings unavailable. This does not mean there are no warnings.')}</p>}
          {!error && fetchedAt && <p role="status">
            {count ? t(`${count} Warnmeldungen · Gebiete anklicken für Details.`, `${count} warnings · click an area for details.`)
              : t('Keine Warnungen in dieser Darstellung. Daraus lässt sich keine Warnfreiheit ableiten.', 'No warnings in this presentation. This does not mean there are no warnings.')}
          </p>}
          {fetchedAt && <small>{t('Abgerufen', 'Fetched')}: {format.format(new Date(fetchedAt))}</small>}
          <button type="button" className="reload-button" onClick={() => setReload((value) => value + 1)}>
            {t('↻ Warnungen neu laden', '↻ Reload warnings')}
          </button>
          <details>
            <summary>{t('Warnstufen und Hinweise', 'Warning levels and notes')}</summary>
            {COLORS.slice(1).map((color, index) => <div className="warning-level" key={color}>
              <span style={{ backgroundColor: color }} /> {index + 1}: {levelName(index + 1)}
            </div>)}
            <p>{t('Nur Deutschland. Warntexte bleiben im deutschen Original. Farbige Flächen können auch bevorstehende Warnungen betreffen; Gültigkeit und Höhenangaben beachten.', 'Germany only. Warning texts remain in the original German. Coloured areas may also show upcoming warnings; check validity and altitude restrictions.')}</p>
          </details>
          {selected.map((warning) => (
            <section className="warning-card" key={warning.identifier} aria-label={t('Warndetails', 'Warning details')}>
              <button type="button" className="station-card-close" aria-label={t('Warnung schließen', 'Close warning')}
                onClick={() => setSelected((items) => items.filter((item) => item.identifier !== warning.identifier))}>×</button>
              <p>{t('Stufe', 'Level')} {warning.level || '–'} · {levelName(warning.level)}</p>
              <h3 lang="de">{warning.headline}</h3>
              <p>{warning.area}</p>
              <p>{Date.parse(warning.onset) > now ? t('Beginnt', 'Starts') : t('Gültig ab', 'Valid from')}: {format.format(new Date(warning.onset))}
                <br />{t('Bis', 'Until')}: {format.format(new Date(warning.expires))}</p>
              {(warning.altitude !== null || warning.ceiling !== null) && <p>
                {t('Höhenangaben vorhanden: Bitte die Einschränkungen im amtlichen Originaltext beachten.', 'Altitude information provided: please check restrictions in the official original text.')}
              </p>}
              <p className="warning-original" lang="de">{warning.description}</p>
              {warning.instruction && <p className="warning-original" lang="de">{warning.instruction}</p>}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
