import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './i18n'
import { PreferenceConsentProvider } from './PreferenceConsentControls'
import 'ol/ol.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferenceConsentProvider><LanguageProvider><App /></LanguageProvider></PreferenceConsentProvider>
  </StrictMode>,
)
