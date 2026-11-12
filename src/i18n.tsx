import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LANGUAGE_KEY, preferencesAllowed } from './preferenceConsent'
import { usePreferenceConsent } from './PreferenceConsentControls'

export type Language = 'de' | 'en'
export type Translate = (german: string, english: string) => string
const mobileMessages = {
  back: ['Zurück', 'Back'],
  search: ['Suche', 'Search'],
  searchPlaceholder: ['Ort, PLZ suchen …', 'Search town, postcode …'],
  layers: ['Ebenen', 'Layers'],
  forecast: ['Vorhersage', 'Forecast'],
  warning: ['Warnungsdetails', 'Warning details'],
  menu: ['Mehr', 'More'],
  timeLayers: ['Radar / Satellit', 'Radar / satellite'],
  timeline: ['Zeitleiste', 'Timeline'],
  radar: ['Radar', 'Radar'],
  satellite: ['Satellit', 'Satellite'],
  play: ['Abspielen', 'Play'],
  pause: ['Pause', 'Pause'],
  previous: ['Eine Aufnahme zurück', 'Previous image'],
  next: ['Eine Aufnahme vor', 'Next image'],
  closeLayer: ['Zeitlayer ausschalten', 'Turn off time layer'],
  showOnMap: ['Auf Karte zeigen', 'Show on map'],
  loading: ['Bild wird geladen …', 'Loading image …'],
  unavailable: ['Nicht verfügbar', 'Unavailable'],
  radarTime: ['Radarzeitpunkt auswählen', 'Select radar time'],
  satelliteTime: ['Satellitenzeitpunkt auswählen', 'Select satellite time'],
  retry: ['Erneut versuchen', 'Try again'],
  warningLevel: ['Wetterwarnung · Stufe', 'Weather warning · level'],
  info: ['Info & Wetterhinweise', 'About & weather limitations'],
} as const
type MobileMessage = keyof typeof mobileMessages
const LanguageContext = createContext<{
  language: Language
  locale: string
  setLanguage: (language: Language) => void
  t: Translate
  mobileText: (key: MobileMessage) => string
} | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { choice } = usePreferenceConsent()
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return preferencesAllowed() && localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'de'
    } catch (error) {
      console.warn('Language preference could not be read:', error)
      return 'de'
    }
  })
  const t = useCallback<Translate>((german, english) => language === 'en' ? english : german, [language])
  useEffect(() => {
    document.documentElement.lang = language
    document.title = t('Wetterkarte Europa', 'Europe Weather Map')
    try {
      if (preferencesAllowed()) localStorage.setItem(LANGUAGE_KEY, language)
    } catch (error) {
      console.warn('Language preference could not be saved:', error)
    }
  }, [language, t, choice])
  const value = useMemo(() => ({
    language, locale: language === 'en' ? 'en-GB' : 'de-DE', setLanguage, t,
    mobileText: (key: MobileMessage) => mobileMessages[key][language === 'de' ? 0 : 1],
  }), [language, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('LanguageProvider is required.')
  return value
}
