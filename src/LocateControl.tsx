import { useEffect, useRef, useState } from 'react'
import type OlMap from 'ol/Map'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke } from 'ol/style'
import Style from 'ol/style/Style'
import { fromLonLat } from 'ol/proj'
import { useLanguage } from './i18n'

export function LocateControl({ map, blocked, onLocated }: {
  map: OlMap | null
  blocked: boolean
  onLocated: () => void
}) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const layer = useRef<VectorLayer<VectorSource<Feature<Point>>> | null>(null)
  const request = useRef(0)
  const [pending, setPending] = useState(false)
  const [located, setLocated] = useState(false)
  const [error, setError] = useState<'unsupported' | 'denied' | 'timeout' | 'unavailable' | null>(null)
  useEffect(() => {
    if (!map) return
    const marker = new VectorLayer({
      source: new VectorSource<Feature<Point>>(),
      style: new Style({
        image: new Circle({
          radius: 9, fill: new Fill({ color: '#146fe8' }),
          stroke: new Stroke({ color: '#fff', width: 4 }),
        }),
      }),
      zIndex: 30,
    })
    layer.current = marker
    map.addLayer(marker)
    return () => {
      request.current += 1
      map.removeLayer(marker)
      marker.getSource()?.clear()
      layer.current = null
    }
  }, [map])
  const locate = () => {
    dialog.current?.close()
    setError(null)
    if (!window.isSecureContext || !navigator.geolocation) { setError('unsupported'); return }
    const id = ++request.current
    setPending(true)
    navigator.geolocation.getCurrentPosition((position) => {
      if (request.current !== id || !map || !layer.current) return
      const { longitude, latitude } = position.coords
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) ||
        Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
        setPending(false); setError('unavailable'); return
      }
      onLocated()
      const coordinate = fromLonLat([longitude, Math.max(-85.051129, Math.min(85.051129, latitude))])
      const source = layer.current.getSource()
      source?.clear()
      source?.addFeature(new Feature({ geometry: new Point(coordinate), ownLocation: true }))
      map.getView().animate({ center: coordinate, zoom: 10,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 })
      setPending(false)
      setLocated(true)
    }, (reason) => {
      if (request.current !== id) return
      setPending(false)
      setError(reason.code === 1 ? 'denied' : reason.code === 3 ? 'timeout' : 'unavailable')
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 })
  }
  return <div className="locate-control" inert={blocked}>
    <button type="button" className="locate-button" disabled={!map || pending}
      aria-label={t('Eigenen Standort anzeigen', 'Show my location')}
      title={t('Eigenen Standort anzeigen', 'Show my location')}
      onClick={() => dialog.current?.showModal()}>⌖</button>
    {(pending || located || error) && <div className="locate-status">
      {pending && <p role="status">{t('Standort wird einmalig ermittelt …', 'Obtaining location once …')}</p>}
      {located && !pending && <><p role="status">{t('Blauer Punkt: eigener Standort (ungefähr).', 'Blue dot: your approximate location.')}</p>
        <button type="button" onClick={() => {
          layer.current?.getSource()?.clear(); setLocated(false); setError(null)
        }}>{t('Standort ausblenden', 'Hide location')}</button></>}
      {error && <p role="alert">{error === 'unsupported'
        ? t('Standortermittlung ist hier nicht verfügbar. HTTPS und Browserunterstützung sind erforderlich.', 'Location is unavailable here. HTTPS and browser support are required.')
        : error === 'denied' ? t('Standortfreigabe abgelehnt. Du kannst sie in den Browser-Einstellungen ändern.', 'Location permission denied. You can change it in your browser settings.')
          : error === 'timeout' ? t('Standortermittlung hat zu lange gedauert. Bitte erneut versuchen.', 'Location request timed out. Please try again.')
            : t('Standort konnte nicht ermittelt werden. Bitte erneut versuchen.', 'Could not obtain your location. Please try again.')}</p>}
    </div>}
    <dialog ref={dialog} className="locate-dialog" aria-labelledby="locate-title">
      <h2 id="locate-title">{t('Eigenen Standort anzeigen?', 'Show your location?')}</h2>
      <p>{t(
        'Erst nach deiner Bestätigung fragen wir den Browser nach einer einmaligen Standortfreigabe. Kein Tracking und keine automatische Wetterabfrage. Die Genauigkeit hängt vom Gerät ab.',
        'Only after confirmation do we ask the browser for one-time location access. No tracking or automatic weather request. Accuracy depends on your device.',
      )}</p>
      <p>{t(
        'Beim Zentrieren verrät der Kartenausschnitt deinen ungefähren Standort an OpenStreetMap und bei aktiver Satellitenebene an EUMETSAT. Browser und Betriebssystem können eigene Standortdienste verwenden.',
        'Centring the map reveals your approximate location to OpenStreetMap and, if satellite is enabled, EUMETSAT. Your browser and operating system may use their own location services.',
      )}</p>
      <p>{t(
        'Die Position bleibt nur für diesen Besuch im Arbeitsspeicher. Nach erfolgreicher Ortung speichern wir für den Rest dieses Besuchs keinen Kartenausschnitt mehr, auch bei aktivierter Einstellungsspeicherung. Bereits gespeicherte Ansichten bleiben unverändert.',
        'The position stays in memory for this visit only. After successful location access we stop saving the map view for the rest of this visit, even if preference storage is enabled. Previously saved views remain unchanged.',
      )}</p>
      <div className="consent-actions">
        <button type="button" onClick={() => dialog.current?.close()} autoFocus>{t('Abbrechen', 'Cancel')}</button>
        <button type="button" onClick={locate}>{t('Standort einmalig verwenden', 'Use location once')}</button>
      </div>
    </dialog>
  </div>
}
