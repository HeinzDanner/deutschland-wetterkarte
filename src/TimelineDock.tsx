import { useLanguage } from './i18n'
import type { LayerPlayback } from './useLayerPlayback'

export type TimeLayer = 'radar' | 'satellite'

export function TimelineDock({ active, radar, satellite, onSelect, onClose, synchronized, onSynchronize }: {
  active: TimeLayer | null
  radar: LayerPlayback | null
  satellite: LayerPlayback | null
  onSelect: (layer: TimeLayer) => void
  onClose: (layer: TimeLayer) => void
  synchronized: boolean
  onSynchronize: (enabled: boolean) => void
}) {
  const { mobileText, locale } = useLanguage()
  const playback = active === 'radar' ? radar : active === 'satellite' ? satellite : null
  if (!playback || !active) return null
  const { frames, index, playing, time, loading, error, select, toggle, reload } = playback
  return <section className="timeline-dock" aria-label={mobileText('timeline')}>
    <div className="timeline-dock-heading">
      <div role="group" aria-label={mobileText('timeline')}>
        {radar && <button type="button" aria-pressed={active === 'radar'} onClick={() => onSelect('radar')}>{mobileText('radar')}</button>}
        {satellite && <button type="button" aria-pressed={active === 'satellite'} onClick={() => onSelect('satellite')}>{mobileText('satellite')}</button>}
      </div>
      <button type="button" className="timeline-sync" aria-pressed={synchronized}
        aria-label={mobileText('synchronizePlayback')} onClick={() => onSynchronize(!synchronized)}>
        {mobileText('synchronize')}
      </button>
      <button type="button" onClick={() => onClose(active)} aria-label={mobileText('closeLayer')}>×</button>
    </div>
    <div className="timeline-dock-controls">
      <button type="button" disabled={!frames.length || index <= 0} onClick={() => select(index - 1)} aria-label={mobileText('previous')}>‹</button>
      <button type="button" disabled={frames.length < 2 || !!error} onClick={toggle} aria-label={mobileText(playing ? 'pause' : 'play')}>{playing ? 'Ⅱ' : '▶'}</button>
      <button type="button" disabled={!frames.length || index >= frames.length - 1} onClick={() => select(index + 1)} aria-label={mobileText('next')}>›</button>
      {time ? <time dateTime={time}>{new Intl.DateTimeFormat(locale, {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Berlin', timeZoneName: 'short',
      }).format(new Date(time))}</time> : <span>{mobileText(loading ? 'loading' : 'unavailable')}</span>}
    </div>
    <input type="range" min={0} max={Math.max(0, frames.length - 1)} value={frames.length ? index : 0}
      disabled={!frames.length} onChange={(event) => select(Number(event.target.value))}
      aria-label={mobileText(active === 'radar' ? 'radarTime' : 'satelliteTime')} />
    {error ? <div className="timeline-dock-error" role="alert"><span>{error}</span>
      <button type="button" onClick={reload}>{mobileText('retry')}</button></div>
      : loading && <span className="timeline-dock-status" role="status">{mobileText('loading')}</span>}
  </section>
}
