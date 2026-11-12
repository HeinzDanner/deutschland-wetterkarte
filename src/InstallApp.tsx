import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './i18n'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function InstallApp({ visible }: { visible: boolean }) {
  const { t } = useLanguage()
  const prompt = useRef<InstallPromptEvent | null>(null)
  const [available, setAvailable] = useState(false)
  const [instructions, setInstructions] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const [installed, setInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true))
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1

  useEffect(() => {
    const before = (event: Event) => {
      if (!('prompt' in event) || typeof event.prompt !== 'function' || !('userChoice' in event)) return
      event.preventDefault()
      prompt.current = event as InstallPromptEvent
      setAvailable(true)
    }
    const done = () => { prompt.current = null; setAvailable(false); setInstalled(true); setInstructions(false) }
    const display = window.matchMedia('(display-mode: standalone)')
    const changed = () => setInstalled(display.matches || ('standalone' in navigator && navigator.standalone === true))
    window.addEventListener('beforeinstallprompt', before)
    window.addEventListener('appinstalled', done)
    display.addEventListener('change', changed)
    return () => {
      window.removeEventListener('beforeinstallprompt', before)
      window.removeEventListener('appinstalled', done)
      display.removeEventListener('change', changed)
    }
  }, [])

  const install = async () => {
    setError(false)
    const event = prompt.current
    if (!event) { setInstructions((open) => !open); return }
    prompt.current = null
    setAvailable(false)
    setPending(true)
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') setInstructions(false)
    } catch (reason) {
      console.warn('App installation prompt failed:', reason)
      setError(true)
      setInstructions(true)
    } finally { setPending(false) }
  }

  if (!visible) return null
  return <section className="install-app">
    {installed ? <p role="status">{t('Die Wetterkarte läuft bereits als App oder wurde gerade hinzugefügt.', 'The weather map is already running as an app or was just added.')}</p> : <>
      <button type="button" className="reload-button" disabled={pending} onClick={() => void install()}
        aria-expanded={!available ? instructions : undefined}>
        {t('Als App hinzufügen', 'Add as app')}
      </button>
      {pending && <p role="status">{t('Bitte den Browserdialog bestätigen oder schließen.', 'Please confirm or dismiss the browser dialog.')}</p>}
      {error && <p role="alert">{t('Der Installationsdialog konnte nicht geöffnet werden. Bitte das Browsermenü verwenden.', 'Could not open the installation dialog. Please use the browser menu.')}</p>}
      {instructions && <div className="install-instructions">
        <p>{ios ? t(
          'Auf iPhone/iPad die Wetterkarte in Safari öffnen. Auf „Teilen“ tippen, dann „Zum Home-Bildschirm“ wählen und mit „Hinzufügen“ bestätigen. Falls angeboten, „Als Web-App öffnen“ einschalten.',
          'On iPhone/iPad, open the weather map in Safari. Tap Share, choose Add to Home Screen, then confirm Add. Enable Open as Web App if offered.',
        ) : t(
          'Im Browsermenü „App installieren“, „Zum Startbildschirm hinzufügen“ oder „App hinzufügen“ wählen, sofern angeboten, und bestätigen. Fehlt der Eintrag, die Seite in einem unterstützten Browser wie Chrome oder Edge öffnen. Die Bezeichnung hängt vom Browser ab.',
          'In your browser menu, choose Install app, Add to Home screen or Add app if available, then confirm. If no option is shown, open the page in a supported browser such as Chrome or Edge. Wording depends on the browser.',
        )}</p>
        <p>{t('Das Hinzufügen musst du selbst bestätigen; die Website kann es nicht automatisch erledigen.', 'You must confirm adding the app yourself; the website cannot do this automatically.')}</p>
      </div>}
    </>}
    <p>{t('Auch als App braucht die Wetterkarte eine Internetverbindung. Keine Offline-Wetterdaten, Push-Nachrichten oder zusätzliche Analyse.', 'The weather map still needs an internet connection when used as an app. No offline weather data, push notifications or additional analytics.')}</p>
  </section>
}
