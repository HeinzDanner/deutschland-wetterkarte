import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearPreferences, CONSENT_KEY, readConsent, setConsent } from './preferenceConsent'
import type { ConsentChoice } from './preferenceConsent'
import { useLanguage } from './i18n'

const ConsentContext = createContext<{
  choice: ConsentChoice | null
  decide: (choice: ConsentChoice) => boolean
} | null>(null)

function currentChoice() {
  try {
    return readConsent(localStorage)?.choice ?? null
  } catch (error) {
    console.warn('Preference consent could not be read:', error)
    return null
  }
}

export function PreferenceConsentProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ConsentChoice | null>(currentChoice)
  useEffect(() => {
    if (choice !== 'accepted') {
      try {
        clearPreferences(localStorage)
      } catch (error) {
        console.warn('Old preferences could not be removed:', error)
      }
    }
  }, [choice])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY || event.key === null) setChoice(currentChoice())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const decide = useCallback((next: ConsentChoice) => {
    try {
      setConsent(localStorage, next)
      setChoice(next)
      return true
    } catch (error) {
      console.error('Preference consent could not be saved:', error)
      setChoice(currentChoice())
      return false
    }
  }, [])
  const value = useMemo(() => ({ choice, decide }), [choice, decide])
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function usePreferenceConsent() {
  const value = useContext(ConsentContext)
  if (!value) throw new Error('PreferenceConsentProvider is required.')
  return value
}

export function PreferenceConsentControls() {
  const { choice, decide } = usePreferenceConsent()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  function choose(next: ConsentChoice) {
    if (decide(next)) {
      setError(false)
      setOpen(false)
    } else {
      setError(true)
    }
  }
  return <>
    <button className="consent-settings-link" type="button" onClick={() => setOpen(true)}>
      {t('Speichereinstellungen', 'Storage settings')}
    </button>
    {(choice === null || open) && <section className="consent-panel" role="region"
      aria-labelledby="consent-title">
      <h2 id="consent-title">{t('Einstellungen auf diesem Gerät speichern?', 'Save preferences on this device?')}</h2>
      <p>{t(
        'Mit deiner Einwilligung speichern wir Sprache, Kartenausschnitt, Ebenen und Satellitendeckkraft im localStorage für spätere Besuche. Ohne Einwilligung gelten sie nur während dieses Besuchs.',
        'With your consent, we store language, map view, layers and satellite opacity in localStorage for future visits. Without consent, they last only for this visit.',
      )}</p>
      <p>{t(
        'Deine Entscheidung wird zusammen mit Zeitpunkt und Textversion auf diesem Gerät gespeichert. Du kannst sie jederzeit über „Speichereinstellungen“ ändern oder widerrufen. Beim Widerruf löschen wir die gespeicherten Einstellungen. Andere Browser oder Geräte verwalten ihre Entscheidung separat.',
        'Your decision, time and text version are stored on this device. You can change or withdraw it at any time using “Storage settings”. Withdrawal removes saved preferences. Other browsers and devices manage their decisions separately.',
      )}</p>
      <p>{t(
        'Diese Entscheidung betrifft nur die Speicherung der Einstellungen, nicht die direkten Verbindungen zu Karten- und Satellitenanbietern.',
        'This choice only concerns preference storage, not direct connections to map and satellite providers.',
      )} {' '}<a href="#datenschutz">{t('Datenschutzhinweise', 'Privacy information')}</a></p>
      {error && <p role="alert">{t(
        'Die Entscheidung konnte nicht gespeichert werden. Bitte prüfe die Browsereinstellungen; lösche bei Bedarf die Website-Daten und versuche es erneut.',
        'Your choice could not be saved. Check your browser settings; if necessary, delete website data and try again.',
      )}</p>}
      <div className="consent-actions">
        <button type="button" onClick={() => choose('rejected')}>{t('Ablehnen / widerrufen', 'Reject / withdraw')}</button>
        <button type="button" onClick={() => choose('accepted')}>{t('Einstellungen speichern', 'Save preferences')}</button>
      </div>
      {open && choice !== null && <button className="consent-close" type="button" onClick={() => setOpen(false)}>
        {t('Schließen ohne Änderung', 'Close without changes')}
      </button>}
    </section>}
  </>
}
