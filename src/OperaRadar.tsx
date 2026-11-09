import { useEffect, useRef, useState } from 'react'
import type OlMap from 'ol/Map'
import ImageLayer from 'ol/layer/Image'
import ImageStatic from 'ol/source/ImageStatic'
import proj4 from 'proj4'
import { register } from 'ol/proj/proj4'
import type { Extent } from 'ol/extent'
import { useLanguage } from './i18n'
import { retainedRadarIndex } from './radarTimeline'

type FrameList = {
  frames: string[]
  latest: string
  colors: [number, [number, number, number]][]
}

type Props = {
  map: OlMap | null
  active: boolean
  onChange: (active: boolean) => void
  synchronized: boolean
  synchronizedTime: string | null
  onFrames: (frames: string[]) => void
  onStatus: (status: RadarStatus) => void
}

export type RadarStatus = { time: string | null; ready: boolean; error: boolean }
async function checkedFetch(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    const body = await response.json() as { error?: string; detail?: string }
    throw new Error(body.detail ?? body.error ?? `OPERA: HTTP ${response.status}`)
  }
  return response
}

function createBuffer(onReady: (time: string) => void) {
  const controller = new AbortController()
  const cache = new Map<string, Promise<ImageStatic>>()
  const urls = new Map<string, string>()
  async function load(time: string) {
    const existing = cache.get(time)
    if (existing) return existing
    const pending = (async () => {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120000)])
      const response = await checkedFetch(`/api/radar/europe/frame/${Date.parse(time)}.json`, signal)
      const frame = await response.json() as { extent: Extent; projection: string; url: string }
      proj4.defs('OPERA:LAEA', frame.projection)
      register(proj4)
      const imageResponse = await checkedFetch(frame.url, signal)
      const blob = await imageResponse.blob()
      if (controller.signal.aborted) throw new DOMException('Abgebrochen', 'AbortError')
      const url = URL.createObjectURL(blob)
      urls.set(time, url)
      const image = new Image()
      image.src = url
      await image.decode()
      if (controller.signal.aborted || !cache.has(time)) {
        URL.revokeObjectURL(url)
        urls.delete(time)
        throw new DOMException('Abgebrochen', 'AbortError')
      }
      const source = new ImageStatic({
        url,
        projection: 'OPERA:LAEA',
        imageExtent: frame.extent,
        interpolate: true,
        attributions: 'Radar: EUMETNET OPERA · CC BY 4.0 · modified',
      })
      onReady(time)
      return source
    })()
    cache.set(time, pending)
    void pending.catch(() => {
      if (cache.get(time) === pending) cache.delete(time)
    })
    return pending
  }
  return {
    load,
    retain(times: string[]) {
      const keep = new Set(times)
      for (const time of cache.keys()) {
        if (keep.has(time)) continue
        cache.delete(time)
        const url = urls.get(time)
        if (url) URL.revokeObjectURL(url)
        urls.delete(time)
      }
    },
    dispose() {
      controller.abort()
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
      cache.clear()
    },
  }
}

export function OperaRadar({ map, active, onChange, synchronized, synchronizedTime, onFrames, onStatus }: Props) {
  const { t, locale } = useLanguage()
  const timeFormat = new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin', timeZoneName: 'short',
  })
  const layer = useRef<ImageLayer<ImageStatic> | null>(null)
  const buffer = useRef<ReturnType<typeof createBuffer> | null>(null)
  const [timeline, setTimeline] = useState<{ data: FrameList | null; index: number }>({ data: null, index: 0 })
  const { data, index } = timeline
  const setIndex = (value: number | ((index: number) => number)) => setTimeline((previous) => ({
    ...previous, index: typeof value === 'function' ? value(previous.index) : value,
  }))
  const [readyFrames, setReadyFrames] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [reload, setReload] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [displayed, setDisplayed] = useState<string | null>(null)
  const time = synchronized
    ? data?.frames.find((frame) => Date.parse(frame) === Date.parse(synchronizedTime ?? ''))
    : data?.frames[index]

  useEffect(() => {
    onFrames(active ? data?.frames ?? [] : [])
  }, [data, active, onFrames])

  useEffect(() => {
    onStatus({ time: displayed, ready: active && !loading && displayed === time && !!time, error: !!error })
  }, [active, loading, displayed, time, error, onStatus])

  useEffect(() => {
    if (synchronized) setPlaying(false)
  }, [synchronized])

  useEffect(() => {
    if (!active || !map) return
    const overlay = new ImageLayer<ImageStatic>({ className: 'opera-radar-layer', visible: false })
    map.getLayers().insertAt(2, overlay)
    layer.current = overlay
    setReadyFrames([])
    const images = createBuffer((time) => setReadyFrames((frames) => frames.includes(time) ? frames : [...frames, time]))
    buffer.current = images
    return () => {
      map.removeLayer(overlay)
      overlay.setSource(null)
      images.dispose()
      layer.current = null
      buffer.current = null
    }
  }, [map, active, reload])

  useEffect(() => {
    setPlaying(false)
    setDisplayed(null)
    setTimeline({ data: null, index: 0 })
    if (!active) return
    const controller = new AbortController()
    const refresh = async () => {
      setRefreshing(true)
      setError(null)
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60000)])
        const response = await checkedFetch('/api/radar/europe/times', signal)
        const result = await response.json() as FrameList
        if (!result.frames.length) throw new Error('Keine OPERA-Radarbilder verfügbar.')
        if (controller.signal.aborted) return
        setTimeline((previous) => ({
          data: result,
          index: retainedRadarIndex(result.frames, previous.data?.frames[previous.index]),
        }))
      } catch (reason) {
        if (controller.signal.aborted) return
        console.warn('OPERA timeline failed:', reason)
        setError(reason instanceof Error ? reason.message : 'OPERA-Zeitpunkte konnten nicht geladen werden.')
      } finally {
        if (!controller.signal.aborted) setRefreshing(false)
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 5 * 60000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [active, reload])

  useEffect(() => {
    const images = buffer.current
    const overlay = layer.current
    if (!active || !time || !images || !overlay) {
      if (synchronized) overlay?.setVisible(false)
      return
    }
    let current = true
    setLoading(true)
    setError(null)
    void images.load(time).then((source) => {
      if (!current) return
      overlay.setSource(source)
      overlay.setVisible(true)
      setDisplayed(time)
      setLoading(false)
    }).catch((reason) => {
      if (!current) return
      console.warn('OPERA image failed:', reason)
      setLoading(false)
      setPlaying(false)
      setError(reason instanceof Error ? reason.message : 'OPERA-Radarbild konnte nicht geladen werden.')
    })
    return () => { current = false }
  }, [active, map, time, data, reload, synchronized])

  useEffect(() => {
    layer.current?.getSource()?.setAttributions(
      `Radar: EUMETNET OPERA · CC BY 4.0 · ${t('Darstellung bearbeitet', 'display modified')}`,
    )
  }, [t, displayed])

  useEffect(() => {
    const images = buffer.current
    if (!active || !data || !images) return
    images.retain(data.frames)
    setReadyFrames((frames) => frames.filter((frame) => data.frames.includes(frame)))
    let current = true
    // Warm the newest frame, then prefetch the history with two workers.
    const prefetch = async () => {
      try {
        await images.load(data.latest)
      } catch (reason) {
        if (current) console.warn('OPERA prefetch failed:', reason)
        // Continue loading history even if the newest frame failed.
      }
      const remaining = data.frames.filter((frame) => frame !== data.latest)
      const worker = async () => {
        while (current && remaining.length) {
          const next = remaining.shift()
          if (next) await images.load(next).catch((reason) => {
            if (current) console.warn('OPERA prefetch failed:', next, reason)
          })
        }
      }
      await Promise.all([worker(), worker()])
    }
    void prefetch()
    return () => { current = false }
  }, [active, map, data, reload])

  useEffect(() => {
    if (synchronized || !playing || !data || data.frames.length < 2 || loading || displayed !== time) return
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % data.frames.length), 500)
    return () => window.clearTimeout(timer)
  }, [playing, data, loading, displayed, time, synchronized])

  return (
    <div className="layer-group">
      <p className="layer-group-title">{t('Europa · Radarverbund', 'Europe · Radar composite')}</p>
      <label className="layer-toggle">
        <input checked={active} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span className="toggle-track" />
        <span>
          <strong>{t('Niederschlagsradar (Europa)', 'Rain radar (Europe)')}</strong>
          <small>{t('EUMETNET OPERA · inklusive Deutschland · 2 km / 15 Minuten', 'EUMETNET OPERA · including Germany · 2 km / 15 minutes')}</small>
        </span>
      </label>
      {active && (
        <details className="radar-timeline" open={!synchronized}>
          <summary hidden={!synchronized}>{t('Radar-Details und Neuladen', 'Radar details and reload')}</summary>
          <div className="radar-time-heading">
            <span>{t('Angezeigtes Bild', 'Displayed image')}</span>
            {displayed ? <time dateTime={displayed}>{timeFormat.format(new Date(displayed))}</time>
              : <span>{error ? t('Nicht verfügbar', 'Unavailable') : t('Lade …', 'Loading …')}</span>}
          </div>
          {data && (
            <>
              {!synchronized && <><input
                aria-label={t('Europäischen Radarzeitpunkt auswählen', 'Select European radar time')}
                className="radar-slider"
                type="range" min={0} max={data.frames.length - 1} value={index}
                onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)) }}
              />
              <div className="radar-controls">
                <button type="button" disabled={index === 0} onClick={() => { setPlaying(false); setIndex(index - 1) }}>−15</button>
                <button type="button" disabled={data.frames.length < 2} onClick={() => {
                  if (!playing && index === data.frames.length - 1) setIndex(0)
                  setPlaying(!playing)
                }}>{playing ? t('Pause', 'Pause') : t('Abspielen', 'Play')}</button>
                <button type="button" disabled={index === data.frames.length - 1} onClick={() => {
                  setPlaying(false); setIndex(index + 1)
                }}>+15</button>
                <button type="button" onClick={() => { setPlaying(false); setIndex(data.frames.length - 1) }}>{t('Neuestes', 'Latest')}</button>
              </div></>}
              <p className="radar-range-note" role="status">
                {t('Bilder vorgeladen', 'Images preloaded')}: {data.frames.filter((frame) => readyFrames.includes(frame)).length} / {data.frames.length}
              </p>
              <progress
                aria-label={t('Radar-Ladefortschritt', 'Radar loading progress')}
                max={data.frames.length}
                value={data.frames.filter((frame) => readyFrames.includes(frame)).length}
              />
            </>
          )}
          {error && <p className="layer-error" role="alert">{t('OPERA-Radardaten konnten nicht geladen werden. Bitte erneut laden.', 'OPERA radar data could not be loaded. Please reload.')}</p>}
          <button type="button" className="reload-button" onClick={() => setReload((count) => count + 1)}>{t('↻ Europa-Radar neu laden', '↻ Reload Europe radar')}</button>
          {refreshing && <p className="radar-range-note" role="status">{t('Radarzeitpunkte werden aktualisiert …', 'Updating radar times …')}</p>}
          <p className={`radar-range-note radar-loading-status${loading ? '' : ' radar-loading-status-idle'}`} role="status">
            {t('OPERA-Radarbild wird geladen …', 'Loading OPERA radar image …')}
          </p>
          <details className="radar-legend">
            <summary>{t('Farblegende und Abdeckung', 'Colour legend and coverage')}</summary>
            <p className="radar-range-note">{t('Niederschlagsrate in mm/h. Einheitliche Farbskala für Europa und Deutschland.', 'Precipitation rate in mm/h. A consistent colour scale for Europe and Germany.')}</p>
            <p className="radar-range-note">{t('Darstellung beim Vergrößern geglättet. Das Messraster bleibt 2 km; keine straßengenaue Aussage.', 'Display smoothed when zooming in. The measurement grid remains 2 km; not street-level precision.')}</p>
            {data?.colors.map(([threshold, color]) => (
              <span className="opera-legend-item" key={threshold}>
                <span style={{ backgroundColor: `rgb(${color.join(',')})` }} /> ≥ {threshold.toLocaleString(locale)}
              </span>
            ))}
            <p className="radar-range-note">
              {t(`Transparent: unter 0,1 mm/h oder keine verwertbaren Radarmesswerte.
              Keine Farbe bedeutet daher nicht automatisch keinen Regen.
              Die Reichweite ist begrenzt; Europa ist nicht lückenlos abgedeckt.
              Fehlende Zeitpunkte werden ausgelassen.`, 'Transparent: below 0.1 mm/h or no usable radar data. No colour does not necessarily mean no rain. Radar range is limited; Europe is not fully covered. Missing time steps are omitted.')}
            </p>
            <p className="radar-range-note">
              {t('Quelle', 'Source')}: <a href="https://eumetnet.github.io/openradardata-documentation/1-ORD-API-overview/" target="_blank" rel="noreferrer">EUMETNET OPERA NIMBUS</a> ·
              {' '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> ·
              {t('Farben, Transparenz und Projektion bearbeitet.', 'Colours, transparency and projection modified.')}
            </p>
          </details>
        </details>
      )}
    </div>
  )
}
