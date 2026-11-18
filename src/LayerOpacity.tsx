import { useLanguage } from './i18n'

export function LayerOpacity({ layer, value, onChange }: {
  layer: 'radar' | 'satellite'
  value: number
  onChange: (value: number) => void
}) {
  const { t } = useLanguage()
  const label = layer === 'radar' ? t('Radar', 'Radar') : t('Satellit', 'Satellite')
  const percentage = `${Math.round(value * 100)} %`
  return <label className="layer-opacity">
    <span>{label}</span>
    <input type="range" min={0} max={1} step={0.05} value={value}
      aria-label={layer === 'radar' ? t('Radar-Deckkraft', 'Radar opacity') : t('Satelliten-Deckkraft', 'Satellite opacity')}
      aria-valuetext={percentage}
      onChange={(event) => onChange(event.target.valueAsNumber)} />
    <span aria-hidden="true">{percentage}</span>
  </label>
}
