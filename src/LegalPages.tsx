import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './i18n'
import { legalConfig } from './legalConfig'

const pages = ['impressum', 'datenschutz', 'quellen', 'wetterhinweise'] as const
type Page = typeof pages[number]

function currentPage(): Page | null {
  return pages.find((page) => window.location.hash === `#${page}`) ?? null
}

export function LegalPages() {
  const { t } = useLanguage()
  const [page, setPage] = useState(currentPage)
  const dialog = useRef<HTMLDialogElement>(null)
  const titles: Record<Page, string> = {
    impressum: t('Impressum', 'Legal notice'),
    datenschutz: t('Datenschutz', 'Privacy'),
    quellen: t('Quellen & Lizenzen', 'Sources & licences'),
    wetterhinweise: t('Wetterhinweise', 'Weather limitations'),
  }
  useEffect(() => {
    const update = () => setPage(currentPage())
    window.addEventListener('hashchange', update)
    window.addEventListener('popstate', update)
    return () => {
      window.removeEventListener('hashchange', update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  useEffect(() => {
    if (page && !dialog.current?.open) dialog.current?.showModal()
    if (!page && dialog.current?.open) dialog.current.close()
  }, [page])
  const close = () => {
    if (currentPage()) window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setPage(null)
  }
  const missing = t('Noch einzutragen', 'To be completed')
  return <>
    <nav className="legal-links" aria-label={t('Rechtliches und Quellen', 'Legal information and sources')}>
      {pages.map((item) => <a key={item} href={`#${item}`}>{titles[item]}</a>)}
    </nav>
    <dialog ref={dialog} className="legal-dialog" aria-labelledby="legal-title" onClose={close}>
      <header className="legal-header">
        <h2 id="legal-title">{page ? titles[page] : ''}</h2>
        <button type="button" onClick={() => dialog.current?.close()} autoFocus>
          {t('Schließen', 'Close')}
        </button>
      </header>
      <div className="legal-body">
        {(page === 'impressum' || page === 'datenschutz') && <p className="legal-draft" role="note">
          <strong>{t('Entwurf – nicht zur Veröffentlichung freigegeben.', 'Draft – not cleared for publication.')}</strong>{' '}
          {t(
            'Betreiberangaben, tatsächlicher Serverbetrieb, Rechtsgrundlagen und Speicherdauern müssen vor dem Start ergänzt und geprüft werden. Dies ist keine rechtliche Freigabe.',
            'Operator details, actual server operation, legal bases and retention periods must be completed and reviewed before launch. This is not legal clearance.',
          )}
        </p>}
        {page === 'impressum' && <>
          <h3>{t('Anbieter und Kontakt', 'Operator and contact')}</h3>
          <dl>
            <dt>{t('Vollständiger Name', 'Full name')}</dt><dd>{legalConfig.operator || missing}</dd>
            <dt>{t('Ladungsfähige Anschrift', 'Serviceable postal address')}</dt>
            <dd className="legal-address">{legalConfig.address || missing}</dd>
            <dt>{t('Kontakt-E-Mail', 'Contact email')}</dt>
            <dd>{legalConfig.email ? <a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a> : missing}</dd>
            <dt>{t('Weitere unmittelbare Kontaktmöglichkeit', 'Additional direct contact method')}</dt>
            <dd>{legalConfig.additionalContact || t('Noch festzulegen und auf Erforderlichkeit zu prüfen.', 'To be determined and assessed for necessity.')}</dd>
          </dl>
          <p>{t(
            'Der Betrieb als natürliche Person setzt keine Firma voraus. Register-, Vertretungs-, berufsrechtliche oder Umsatzsteuerangaben nur ergänzen, soweit tatsächlich einschlägig. Keine persönliche Steuer-ID oder Steuernummer veröffentlichen. Bei journalistisch-redaktionellen Inhalten zusätzliche Verantwortlichkeit prüfen.',
            'An individual operator does not need a company. Add registration, representation, professional or VAT details only where applicable. Do not publish a personal tax ID or tax number. Assess additional responsibility requirements for journalistic/editorial content.',
          )}</p>
        </>}
        {page === 'datenschutz' && <>
          <h3>{t('Verantwortlicher', 'Controller')}</h3>
          <p>{t('Verantwortlich ist der im ', 'The controller is the operator listed in the ')}
            <a href="#impressum">{titles.impressum}</a>.
            {' '}{t('Die Kontaktdaten sind vor Veröffentlichung zu ergänzen.', 'Contact details must be completed before publication.')}</p>
          <h3>{t('Hosting und Serverzugriffe', 'Hosting and server requests')}</h3>
          <p>{t(
            'Der Betreiber nennt Hetzner als Hoster. Die genaue Vertragsgesellschaft und der gebuchte Standort sind noch zu bestätigen. Beim Abruf der Website werden insbesondere IP-Adresse, Zeitpunkt, angeforderte URL und technische Browser-/Verbindungsinformationen an den Webserver übermittelt, um die Website auszuliefern und zu schützen.',
            'The operator has named Hetzner as hosting provider. The contracting entity and selected server location remain to be confirmed. Requests transmit in particular an IP address, time, requested URL and technical browser/connection information to the server to deliver and protect the website.',
          )}</p>
          <p>{t('Serverstandort: ', 'Server location: ')}{legalConfig.hostingLocation || missing}<br />
            {t('Protokolle und Löschfristen: ', 'Logs and retention: ')}{legalConfig.loggingAndRetention || missing}</p>
          <p>{t(
            'Die vorbereitete Caddy-Konfiguration aktiviert keine Zugriffsprotokolle. Betriebs- und Fehlerprotokolle sowie etwaige Provider-, Firewall- oder Proxy-Protokolle sind davon zu unterscheiden; der tatsächliche Betrieb ist noch abzugleichen. Auftragsverarbeitung, Empfänger, Rechtsgrundlage und Löschfristen sind vor Freigabe festzulegen.',
            'The prepared Caddy configuration does not enable access logs. Operational and error logs, and any provider, firewall or proxy logs are separate; actual operation still needs to be checked. Processing arrangements, recipients, legal basis and retention must be established before clearance.',
          )}</p>
          <a href="https://www.hetzner.com/legal/privacy-policy/">{t('Datenschutzhinweise von Hetzner', 'Hetzner privacy policy')}</a>
          <h3>{t('Direkte Verbindungen zu Karten- und Satellitenanbietern', 'Direct map and satellite connections')}</h3>
          <p>{t(
            'Der Browser lädt Kartenkacheln direkt von tile.openstreetmap.org. Bei aktiviertem Satellitenbild werden Bilder direkt von view.eumetsat.int geladen. Dabei erhalten diese Anbieter die IP-Adresse und technische Anfragedaten; je nach Referrer-Einstellung auch die Herkunftswebsite. Es handelt sich nicht nur um Links: Verbindungen entstehen bei Nutzung der jeweiligen Darstellung. Empfänger, Rechtsgrundlagen, mögliche Drittlandverarbeitung und eine gegebenenfalls erforderliche Einwilligung müssen vor Veröffentlichung bewertet werden.',
            'The browser loads map tiles directly from tile.openstreetmap.org. When satellite imagery is enabled, images are loaded directly from view.eumetsat.int. These providers receive an IP address and technical request information, and potentially the referring website depending on referrer settings. These are not merely links: using the respective display establishes connections. Recipients, legal bases, possible processing outside the EEA and any consent requirement must be assessed before publication.',
          )}</p>
          <p><a href="https://osmfoundation.org/wiki/Privacy_Policy">OpenStreetMap Foundation – Privacy Policy</a>
            {' · '}<a href="https://www.eumetsat.int/privacy-policy">EUMETSAT – Privacy Policy</a></p>
          <h3>{t('Suche, Vorhersagen und Wetterdaten', 'Search, forecasts and weather data')}</h3>
          <p>{t(
            'Suchtexte werden über unseren Server an die Geocoding-API von Open-Meteo weitergegeben; deutsche Postleitzahlen an Zippopotam.us. Für Vorhersagen gehen die gewählten Koordinaten an Open-Meteo (DWD ICON). Diese Dienste sehen bei diesen Serverabrufen die Server-IP, nicht unmittelbar die Browser-IP. Ortsnamen und Koordinaten können dennoch personenbezogen sein. Bitte keine Namen, privaten Anschriften oder andere vertrauliche Angaben in die Suche eingeben. Radar, Stationswerte und Warnungen werden serverseitig von den jeweiligen Wetterdatenquellen abgerufen.',
            'Search text is sent through our server to Open-Meteo geocoding; German postcodes are sent to Zippopotam.us. Selected coordinates are sent to Open-Meteo (DWD ICON) for forecasts. For these server requests the services see the server IP rather than directly seeing the browser IP. Locations and coordinates may still constitute personal data. Do not enter names, private addresses or other confidential information in search. Radar, station readings and warnings are retrieved server-side from their respective providers.',
          )}</p>
          <h3>{t('Lokale Einstellungen und technische Speicherung', 'Local preferences and technical storage')}</h3>
          <p>{t(
            'Im localStorage dieses Browsers werden weather-map-language (Sprache), weather-map-view (Kartenausschnitt) und weather-map-layers (Ebenen und Satellitendeckkraft) gespeichert. Diese Einstellungen werden bei weiteren Besuchen gelesen und bleiben bis zum Löschen der Website-Daten im Browser erhalten. Die App speichert dort keinen Suchverlauf. Der Browser kann Bilder und andere Dateien nach den HTTP-Cache-Regeln zwischenspeichern. Das Löschen von Website-Daten entfernt auch die Einstellungen.',
            'This browser’s localStorage stores weather-map-language (language), weather-map-view (map view) and weather-map-layers (layers and satellite opacity). These settings are read on future visits and remain until website data is deleted in the browser. The app does not store search history there. The browser may cache images and other files according to HTTP cache rules. Deleting website data also removes preferences.',
          )}</p>
          <p>{t(
            'Die App enthält derzeit keine eingebundene Analyse- oder Werbesoftware und keine Benutzerkonten. Das ersetzt keine Prüfung: § 25 TDDDG betrifft auch localStorage. Ob die automatische Einstellungsspeicherung erforderlich ist oder eine vorherige Einwilligung bzw. technische Änderung benötigt, ist vor Veröffentlichung zu klären. Ein Einwilligungsmanagement ist derzeit nicht implementiert.',
            'The app currently includes no analytics or advertising software and no user accounts. This does not replace an assessment: section 25 TDDDG also covers localStorage. Before publication, determine whether automatic preference storage is necessary or requires prior consent or a technical change. Consent management is not currently implemented.',
          )}</p>
          <p>{t(
            'Serverseitige Caches dienen der Bereitstellung von Wetterdaten. Die Stations-Ausfallhistorie enthält Stationskennungen und Verfügbarkeitsereignisse, keine beabsichtigte Besucherhistorie.',
            'Server-side caches serve weather data. Station outage history contains station identifiers and availability events, not an intended visitor history.',
          )}</p>
          <h3>{t('Kontakt und Rechte', 'Contact and rights')}</h3>
          <p>{t(
            'Bei Kontaktaufnahme werden übermittelte Kontaktdaten und Nachrichten zur Bearbeitung des Anliegens verarbeitet. Rechtsgrundlage und Löschfristen sind vom Betreiber noch festzulegen. Nach Maßgabe der DSGVO bestehen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch; soweit eine Einwilligung verwendet wird, kann sie mit Wirkung für die Zukunft widerrufen werden. Beschwerden sind bei einer Datenschutzaufsichtsbehörde möglich. Zuständige Behörde und Kontakt des Verantwortlichen vor Veröffentlichung ergänzen.',
            'Contact details and messages submitted when contacting the operator are processed to handle the enquiry. The operator must still determine the legal basis and retention. Subject to GDPR conditions, rights include access, rectification, erasure, restriction, portability and objection; any consent may be withdrawn for the future. Complaints may be lodged with a data protection supervisory authority. Add the competent authority and controller contact before publication.',
          )}</p>
        </>}
        {page === 'quellen' && <>
          <h3>{t('Wetter- und Kartendaten', 'Weather and map data')}</h3>
          <ul>
            <li><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
              {' – '}{t('Kartendaten unter ODbL; ', 'map data under ODbL; ')}
              <a href="https://operations.osmfoundation.org/policies/tiles/">{t('gesonderte Kachel-Nutzungsrichtlinie', 'separate tile usage policy')}</a>.</li>
            <li><a href="https://eumetnet.github.io/openradardata-documentation/1-ORD-API-overview/">EUMETNET OPERA / NIMBUS</a>
              {' – '}<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
              {' '}{t('Radarverbund RATE, 2 km. Bearbeitet: Rohwerte in farbige PNGs umgewandelt, niedrige/fehlende Werte transparent dargestellt, reprojiziert und bei der Anzeige interpoliert. Keine höhere Messauflösung durch Glättung.',
                'RATE radar composite, 2 km. Modified: raw values converted into coloured PNGs, low/missing values made transparent, reprojected and interpolated for display. Smoothing does not increase measurement resolution.')}</li>
            <li><a href="https://www.dwd.de/">Deutscher Wetterdienst (DWD)</a>
              {' – '}{t('Stationsbeobachtungen und amtliche Warnungen; Warnflächen für die Anzeige zusammengeführt. ',
                'station observations and official warnings; warning polygons merged for display. ')}
              <a href="https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise.html">{t('Rechtliche Hinweise', 'Legal information')}</a>.</li>
            <li><a href="https://www.eumetsat.int/">EUMETSAT</a>
              {' – '}{t('Meteosat-Infrarotbilder über view.eumetsat.int, msg_fes:ir108. Anzeige mit angepasstem Kontrast, Helligkeit und Überblendung.',
                'Meteosat infrared imagery via view.eumetsat.int, msg_fes:ir108. Displayed with adjusted contrast, brightness and blending.')}</li>
            <li><a href="https://open-meteo.com/">Open-Meteo</a>
              {' – '}{t('Vorhersagen (DWD ICON) und Ortssuche; ', 'forecasts (DWD ICON) and geocoding; ')}
              <a href="https://open-meteo.com/en/licence">CC BY 4.0</a>
              {' · '}<a href="https://open-meteo.com/en/terms">{t('API-Nutzungsbedingungen', 'API terms')}</a>.
              {' '}{t('Die kostenlose API ist nur für nichtkommerzielle Nutzung vorgesehen; auch Werbung und werbliche Aktivitäten beachten.',
                'The free API is for non-commercial use only; advertising and promotional activities must also be considered.')}</li>
            <li><a href="https://www.zippopotam.us/">Zippopotam.us</a>
              {' – '}{t('deutsche Postleitzahlsuche.', 'German postcode lookup.')}</li>
            <li><a href="https://www.geonames.org/">GeoNames</a>
              {' – '}{t('Ortsdaten der Open-Meteo-Ortssuche; ', 'location data used by Open-Meteo geocoding; ')}
              <a href="https://www.geonames.org/export/">{t('Attributions- und Lizenzhinweise', 'attribution and licence information')}</a>.</li>
          </ul>
          <p className="legal-draft">{t(
            'Noch offen vor Freigabe: konkrete EUMETSAT-WMS-Bedingungen, Zippopotam.us-Dienst- und Datenbedingungen, produktbezogene DWD-Vorgaben sowie Herkunft/Lizenz der eingebundenen Deutschland-Geometrie. Eine Quellenangabe ersetzt keine Nutzungserlaubnis.',
            'Still unresolved before clearance: exact EUMETSAT WMS terms, Zippopotam.us service and data terms, product-specific DWD requirements and provenance/licence of the bundled Germany geometry. Attribution does not replace permission to use a source.',
          )}</p>
          <h3>{t('Software', 'Software')}</h3>
          <p>{t('Verwendet werden unter anderem React, OpenLayers, proj4, geotiff, pngjs und polygon-clipping. ',
            'Software includes React, OpenLayers, proj4, geotiff, pngjs and polygon-clipping. ')}
            <a href="./third-party-notices.txt">{t('Lizenztexte und Hinweise der Produktionsabhängigkeiten', 'Production dependency licence texts and notices')}</a>.
          </p>
          <p>{t(
            'Für den eigenen Anwendungscode wurde noch keine Veröffentlichungslizenz gewählt. Datenlizenzen und Lizenzen eingebundener Software gelten jeweils getrennt; die Veröffentlichung eines Repositorys allein erteilt keine pauschale Nutzungserlaubnis für den eigenen Code.',
            'No publication licence has been selected for the application’s own code. Data and third-party software licences apply separately; publishing a repository alone does not grant blanket permission to reuse the application code.',
          )}</p>
        </>}
        {page === 'wetterhinweise' && <>
          <p>{t(
            'Diese Wetterkarte ist ein ergänzendes Informationsangebot, kein amtlicher Warnkanal und kein Notfalldienst. Daten können verzögert, unvollständig, fehlerhaft oder nicht verfügbar sein. Keine Push-Warnungen oder lückenlose Überwachung zugesichert.',
            'This weather map is supplementary information, not an official alert channel or emergency service. Data may be delayed, incomplete, incorrect or unavailable. Push alerts and continuous monitoring are not promised.',
          )}</p>
          <p>{t(
            'Für sicherheitsrelevante Entscheidungen amtliche Warnungen und deren Originaltext, Gültigkeit und Höhenbezug beachten. Im Notfall die zuständige Notrufnummer nutzen. Maßgeblich sind die Veröffentlichungen des ',
            'For safety-related decisions, consult official warnings including original text, validity and altitude restrictions. In emergencies use the appropriate emergency number. Refer to the official publications of the ')}
            <a href="https://www.dwd.de/DE/wetter/warnungen_gemeinden/warnWetter_node.html">Deutscher Wetterdienst</a>.</p>
          <p>{t(
            'Radar zeigt eine aus Messungen abgeleitete Niederschlagsintensität, Satellit Infrarot die Wolken-/Strahlungssituation, nicht Regenintensität. Transparenz bedeutet nicht zuverlässig Niederschlagsfreiheit. Glättung verbessert nur die Darstellung. Zusammengeführte Warnflächen dienen der Übersicht; beim Anklicken gelten die ursprünglichen lokalen Warntexte.',
            'Radar shows precipitation intensity derived from measurements; infrared satellite shows cloud/radiation conditions, not rainfall intensity. Transparency does not reliably mean no rain. Smoothing only changes appearance. Merged warning polygons are an overview; clicking retrieves the original local warning text.',
          )}</p>
          <p>{t(
            'Synchronisation verwendet gemeinsame verfügbare Zeitpunkte, die älter als das neueste Einzelbild sein können. Immer die angezeigte Datenzeit prüfen. Modellvorhersagen sind keine punktgenauen Messungen.',
            'Synchronisation uses shared available timestamps, which may be older than the newest individual image. Always check displayed data times. Model forecasts are not exact point measurements.',
          )}</p>
        </>}
      </div>
    </dialog>
  </>
}
