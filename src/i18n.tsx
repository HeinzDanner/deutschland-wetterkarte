import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LANGUAGE_KEY, preferencesAllowed } from './preferenceConsent'
import { usePreferenceConsent } from './PreferenceConsentControls'

export type Language = 'de' | 'en'
export type Translate = (german: string, english: string) => string
const LanguageContext = createContext<{
  language: Language
  locale: string
  setLanguage: (language: Language) => void
  t: Translate
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
  }), [language, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('LanguageProvider is required.')
  return value
}
