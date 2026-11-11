import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './i18n'
import { legalConfig } from './legalConfig'
import { satelliteSource, satelliteDataYear } from './satelliteAttribution'

const pages = ['impressum', 'datenschutz', 'quellen', 'wetterhinweise'] as const
type Page = typeof pages[number]

function currentPage(): Page | null {
  return pages.find((page) => window.location.hash === `#${page}`) ?? null
}

export function LegalPages({ satelliteTime = null }: { satelliteTime?: string | null }) {
  const { t } = useLanguage()
  const satelliteYear = satelliteDataYear(satelliteTime)
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
      <a href="/application-source.tar.gz" download>{t('Quellcode (AGPL)', 'Source code (AGPL)')}</a>
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
            'Angaben, tatsächlicher Serverbetrieb, Rechtsgrundlagen und Speicherdauern müssen vor dem Start geprüft und gegebenenfalls ergänzt werden. Dies ist keine rechtliche Freigabe.',
            'Details, actual server operation, legal bases and retention periods must be reviewed and completed where necessary before launch. This is not legal clearance.',
          )}
        </p>}
        {page === 'impressum' && <>
          <h3>{t('Angaben gemäß § 5 DDG', 'Information pursuant to section 5 DDG')}</h3>
          <dl>
            <dt>{t('Vollständiger Name', 'Full name')}</dt><dd>{legalConfig.operator || missing}</dd>
            <dt>{t('Ladungsfähige Anschrift', 'Serviceable postal address')}</dt>
            <dd className="legal-address">{legalConfig.address || missing}</dd>
            <dt>{t('Kontakt-E-Mail', 'Contact email')}</dt>
            <dd>{legalConfig.email ? <a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a> : missing}</dd>
            {legalConfig.additionalContact && <>
              <dt>{t('Weitere unmittelbare Kontaktmöglichkeit', 'Additional direct contact method')}</dt>
              <dd>{legalConfig.additionalContact}</dd>
            </>}
          </dl>
          <p>{t(
            'Die Wetterdaten werden von den genannten Wetterdiensten bezogen und aufbereitet dargestellt. Richtigkeit, Vollständigkeit und Aktualität der Wetterdaten, Warnungen und Vorhersagen sind nicht gewährleistet. Diese Darstellung ersetzt keinen amtlichen Warnkanal; maßgeblich sind die offiziellen Warnungen des Deutschen Wetterdienstes.',
            'Weather data is obtained from the listed weather services and processed for display. Accuracy, completeness and timeliness of weather data, warnings and forecasts are not guaranteed. This presentation does not replace an official alert channel; the official warnings issued by Deutscher Wetterdienst are authoritative.',
          )}</p>
          <h3>{t('Externe Links', 'External links')}</h3>
          <p>{t(
            'Diese Website enthält Links zu externen Websites. Deren Inhalte werden von den jeweiligen Anbietern verantwortet; auf ihre Gestaltung haben wir keinen Einfluss.',
            'This website contains links to external websites. Their respective providers are responsible for their content; we have no control over their design.',
          )}</p>
          <h3>{t('Quellenverzeichnis', 'Sources')}</h3>
          <p>{t('Die verwendeten Datenquellen, Lizenz- und Bearbeitungshinweise sind unter ', 'The data sources, licences and modification notices are listed under ')}
            <a href="#quellen">{titles.quellen}</a>
            {t(' aufgeführt und Bestandteil dieses Impressums.', ' and form part of this legal notice.')}</p>
          <h3>{t('Datenbasis der Wetterwarnungen', 'Weather warning data source')}</h3>
          <p>{t(
            'Datenbasis: Deutscher Wetterdienst, Wetterwarnungen — Warngebiete zusammengeführt und gefiltert dargestellt. ',
            'Data source: Deutscher Wetterdienst, weather warnings — warning areas merged and filtered for display. ',
          )}{t('Weitere Angaben unter ', 'Further details under ')}
            <a href="#quellen">{titles.quellen}</a>.</p>
        </>}
        {page === 'datenschutz' && <>
          <p>{t('Stand: 11. November 2026. Rechtliche Prüfung bleibt offen.', 'Last updated: 11 November 2026. Legal review remains outstanding.')}</p>
          <h3>{t('1. Verantwortlicher', '1. Controller')}</h3>
          <p>{t('Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO):', 'Controller within the meaning of the General Data Protection Regulation (GDPR):')}</p>
          <p className="legal-address">{legalConfig.operator}{'\n'}{legalConfig.address}</p>
          <p>{t('E-Mail: ', 'Email: ')}<a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a></p>
          <h3>{t('2. Überblick: Was diese Website macht', '2. Overview: what this website does')}</h3>
          <p>{t(
            'Diese Website bietet eine interaktive Wetterkarte für Europa mit Radardaten, Stationswerten, Vorhersagen, Ortssuche und einer eigenen Darstellung auf Basis amtlicher Wetterwarnungen. Es gibt keine Benutzerkonten, keine Anmeldedatenbank, keine Analyse- oder Werbe-Software und keine Zahlungsabwicklung. Personenbezogene Daten fallen in dem nachfolgend beschriebenen Umfang an.',
            'This website provides an interactive weather map for Europe with radar data, station readings, forecasts, location search and its own presentation based on official weather warnings. There are no user accounts, login database, analytics or advertising software, or payment processing. Personal data is processed to the extent described below.',
          )}</p>
          <h3>{t('3. Hosting und Serverprotokolle', '3. Hosting and server logs')}</h3>
          <p>{t(
            'Die Website wird auf einem Hetzner-Server in Falkenstein, Deutschland, betrieben. Mit dem Hosting-Anbieter wurde ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO abgeschlossen. PRÜFEN: Die im Entwurf genannte Vertragsgesellschaft Hetzner Online GmbH anhand der Vertragsunterlagen bestätigen.',
            'The website is hosted on a Hetzner server in Falkenstein, Germany. A data processing agreement under Article 28 GDPR has been concluded with the hosting provider. CHECK: Confirm Hetzner Online GmbH, the contracting entity named in the draft, against the contract documents.',
          )}</p>
          <p>{t('Serverstandort: ', 'Server location: ')}{legalConfig.hostingLocation || missing}<br />
            {t('Protokolle und Löschfristen: ', 'Logs and retention: ')}{legalConfig.loggingAndRetention || missing}</p>
          <p>{t(
            'Die mitgelieferte Caddy-Konfiguration aktiviert keine Zugriffsprotokolle über Seitenaufrufe. Das schließt technische Betriebs- und Fehlerprotokolle nicht aus. System- und Sicherheitsprotokolle, etwa über fehlgeschlagene SSH-Anmeldungen, können IP-Adressen enthalten und dienen der Absicherung und Fehlersuche. Container-Logs rotieren mit maximal drei Dateien zu jeweils 10 MB je Container; dies ist eine Größenbegrenzung, keine feste Löschfrist. PRÜFEN: Tatsächliche Protokolle, Rotationsregeln und Löschfristen von Host und Provider feststellen.',
            'The supplied Caddy configuration does not enable access logs for page requests. This does not exclude technical operational and error logs. System and security logs, for example of failed SSH logins, may contain IP addresses and serve security and troubleshooting purposes. Container logs rotate with a maximum of three files of 10 MB each per container; this is a size limit, not a fixed retention period. CHECK: Establish the actual logs, rotation rules and retention periods of the host and provider.',
          )}</p>
          <p className="legal-draft">{t(
            'PRÜFEN: Nach dem ersten Produktionsstart mit docker compose logs api beziehungsweise docker logs kontrollieren, ob das Backend bei Anfragen IP-Adressen protokolliert. Falls ja, diesen Abschnitt um Datenumfang, Zweck, Rechtsgrundlage und Löschfristen ergänzen. Die Prüfung am laufenden Server steht noch aus.',
            'CHECK: After the first production start, use docker compose logs api or docker logs to check whether the backend logs IP addresses when handling requests. If it does, supplement this section with the data involved, purpose, legal basis and retention periods. Inspection of the running server remains outstanding.',
          )}</p>
          <a href="https://www.hetzner.com/legal/privacy-policy/">{t('Datenschutzhinweise von Hetzner', 'Hetzner privacy policy')}</a>
          <h3>{t('4. Keine Cookies', '4. No cookies')}</h3>
          <p>{t(
            'Die Anwendung setzt keine Cookies und bindet keine Tracker, Analyse-Dienste oder Werbenetzwerke ein. Direkte Verbindungen zu Datenanbietern werden in Abschnitt 6 beschrieben.',
            'The application does not set cookies or include trackers, analytics services or advertising networks. Direct connections to data providers are described in section 6.',
          )}</p>
          <h3>{t('5. Speicherung in deinem Browser (localStorage)', '5. Storage in your browser (localStorage)')}</h3>
          <p>{t(
            'Nur nach ausdrücklicher Zustimmung speichern und lesen wir für spätere Besuche die Sprache (weather-map-language), Kartenmittelpunkt und Zoom (weather-map-view) sowie Ebenenauswahl und Satellitendeckkraft (weather-map-layers). Ohne Zustimmung funktioniert die Karte vollständig; Einstellungen gelten nur während des Besuchs und beim nächsten Besuch gelten die Standardwerte.',
            'Only after explicit acceptance do we store and read the language (weather-map-language), map centre and zoom (weather-map-view), and layer selection and satellite opacity (weather-map-layers) for future visits. Without acceptance the map remains fully functional; preferences last only for the visit and the defaults apply on the next visit.',
          )}</p>
          <p>{t(
            'Über „Speichereinstellungen“ im Seitenfuß und anschließend „Ablehnen / widerrufen“ kannst du jederzeit ablehnen oder eine Zustimmung widerrufen. Gespeicherte Einstellungen werden dabei gelöscht und ohne erneute Zustimmung nicht neu angelegt. Über „Einstellungen speichern“ kannst du zustimmen. Alle Funktionen bleiben bei Ablehnung nutzbar.',
            'You can reject storage or withdraw acceptance at any time using “Storage settings” in the footer and then “Reject / withdraw”. Saved preferences are deleted and are not stored again without renewed acceptance. Use “Save preferences” to accept. All features remain available if you reject.',
          )}</p>
          <p>{t(
            'Die Entscheidung selbst – auch eine Ablehnung oder ein Widerruf – wird mit Zeitpunkt und Textversion unter weather-map-preference-consent auf diesem Gerät gespeichert. Sie bleibt bis zur Änderung der Entscheidung oder zum Löschen der Website-Daten bestehen. Sie wird nicht an unseren Server übertragen und ist kein unabhängiger serverseitiger Einwilligungsnachweis. Browser und Geräte verwalten ihre Entscheidung jeweils getrennt. Alle lokalen Daten kannst du zusätzlich in den Browsereinstellungen löschen. Die App speichert keinen Suchverlauf; Dateien können nach HTTP-Cache-Regeln zwischengespeichert werden.',
            'The decision itself – including rejection or withdrawal – is stored with its time and text version under weather-map-preference-consent on this device. It remains until you change the decision or delete website data. It is not sent to our server and is not independent server-side evidence of consent. Browsers and devices manage their decisions separately. You can also delete all local data in your browser settings. The app does not store a search history; files may be cached under HTTP cache rules.',
          )}</p>
          <p>{t(
            'Die Einwilligung betrifft nur die Speicherung von Einstellungen, nicht direkte Drittanbieter-Verbindungen. Die rechtliche Einordnung der Speicherung der Entscheidung selbst ist noch zu prüfen. Rechtsgrundlagen der optionalen Einstellungsspeicherung sind § 25 Abs. 1 TDDDG und, soweit personenbezogene Daten betroffen sind, Art. 6 Abs. 1 lit. a DSGVO.',
            'Consent covers preference storage only, not direct third-party connections. The legal classification of storing the decision itself remains to be reviewed. Optional preference storage is based on section 25(1) TDDDG and, insofar as personal data is involved, Article 6(1)(a) GDPR.',
          )}</p>
          <h3>{t('6. Abruf der Wetterdaten', '6. Retrieval of weather data')}</h3>
          <h4>{t('Direkt aus deinem Browser', 'Directly from your browser')}</h4>
          <p>{t(
            'Der Browser lädt Kartenkacheln direkt von tile.openstreetmap.org (OpenStreetMap Foundation). Bei aktivierter Satellitenebene lädt er Meteosat-Bilder direkt von view.eumetsat.int (EUMETSAT/EUMETView). Dabei werden insbesondere deine IP-Adresse, angeforderte Kartenausschnitte beziehungsweise Bildparameter und technische Verbindungsdaten sowie gegebenenfalls die Herkunftswebsite übermittelt. Die Bilder werden vom Anbieter an deinen Browser geliefert. Die Ebene ist aktivierbar: EUMETSAT Legal Affairs bestätigte am 11.11.2026 die Nutzung von EUMETView-Daten einschließlich msg_fes:ir108 unter CC BY 4.0. Diese Datenlizenz ersetzt keine Datenschutzprüfung. PRÜFEN: Empfänger, Rechtsgrundlagen, mögliche Drittlandverarbeitung und eine gegebenenfalls erforderliche Einwilligung für direkte Verbindungen.',
            'Your browser loads map tiles directly from tile.openstreetmap.org (OpenStreetMap Foundation). When the satellite layer is enabled, it loads Meteosat images directly from view.eumetsat.int (EUMETSAT/EUMETView). These requests transmit in particular your IP address, requested map areas or image parameters, technical connection data and potentially the referring website. The provider delivers the images to your browser. The layer can be enabled: on 11 November 2026, EUMETSAT Legal Affairs confirmed use of EUMETView data including msg_fes:ir108 under CC BY 4.0. This data licence does not replace a privacy review. CHECK: Recipients, legal bases, possible processing outside the EEA and any consent requirement for direct connections.',
          )}</p>
          <p><a href="https://osmfoundation.org/wiki/Privacy_Policy">OpenStreetMap Foundation – Privacy Policy</a>
            {' · '}<a href="https://www.eumetsat.int/privacy-policy">EUMETSAT – Privacy Policy</a></p>
          <h4>{t('Über den Server der Website', 'Through the website server')}</h4>
          <p>{t(
            'Radar, Stationswerte, Warnungen und Vorhersagen ruft unser Server bei OPERA/EUMETNET, dem Deutschen Wetterdienst und Open-Meteo ab; Satellitenzeitmetadaten bei EUMETSAT. Diese Dienste sehen die Server-IP, nicht die Browser-IP. Bei der Ortssuche wird dein Suchbegriff über unseren Server an Open-Meteo Geocoding (Daten von GeoNames), für deutsche Postleitzahlen an Zippopotam.us weitergegeben. Für Vorhersagen werden die gewählten Koordinaten an Open-Meteo übermittelt. Solche Angaben können personenbezogen sein. Die App verknüpft sie nicht mit Benutzerprofilen. Bitte keine privaten Anschriften oder vertraulichen Angaben eingeben.',
            'Our server retrieves radar data, station readings, warnings and forecasts from OPERA/EUMETNET, Deutscher Wetterdienst and Open-Meteo, and satellite time metadata from EUMETSAT. These services see the server IP, not your browser IP. Location searches pass your search term through our server to Open-Meteo geocoding (GeoNames data), or to Zippopotam.us for German postcodes. Forecast requests transmit the selected coordinates to Open-Meteo. Such information may constitute personal data. The app does not link it to user profiles. Please do not enter private addresses or confidential information.',
          )}</p>
          <p>{t(
            'Open-Meteo gibt für seinen kostenlosen API-Dienst an, zur Fehlersuche Serverprotokolle zu führen, die etwa geografische Koordinaten enthalten können, und diese nach 90 Tagen zu löschen. Es gelten die Datenschutzhinweise des Anbieters.',
            'Open-Meteo states that its free API service keeps server logs for troubleshooting, which may contain information such as geographical coordinates, and deletes them after 90 days. The provider’s privacy notice applies.',
          )}</p>
          <a href="https://open-meteo.com/en/terms#privacy">{t('Datenschutzhinweise von Open-Meteo', 'Open-Meteo privacy notice')}</a>
          <p>{t(
            'Serverseitige Caches dienen der Bereitstellung von Wetterdaten. Die Stations-Ausfallhistorie enthält Stationskennungen und Verfügbarkeitsereignisse, keine beabsichtigte Besucherhistorie.',
            'Server-side caches serve weather data. Station outage history contains station identifiers and availability events, not an intended visitor history.',
          )}</p>
          <h3>{t('7. Rechtsgrundlagen', '7. Legal bases')}</h3>
          <p>{t(
            'Die Verarbeitung technischer Verbindungsdaten zum Betrieb und zur Sicherheit der Website stützen wir auf Art. 6 Abs. 1 lit. f DSGVO: berechtigtes Interesse an der Bereitstellung und Absicherung des Dienstes. Optionale Einstellungsspeicherung erfolgt auf Grundlage von § 25 Abs. 1 TDDDG und, soweit personenbezogene Daten betroffen sind, Art. 6 Abs. 1 lit. a DSGVO. PRÜFEN: Interessenabwägung, Einwilligungsnachweis, Speicherung der Entscheidung und Verarbeitung durch Drittanbieter abschließend rechtlich bewerten.',
            'We rely on Article 6(1)(f) GDPR for processing technical connection data to operate and secure the website: our legitimate interest in providing and protecting the service. Optional preference storage is based on section 25(1) TDDDG and, insofar as personal data is involved, Article 6(1)(a) GDPR. CHECK: Complete the legal assessment of the balancing of interests, evidence of consent, decision storage and third-party processing.',
          )}</p>
          <h3>{t('8. Deine Rechte und Kontakt', '8. Your rights and contact')}</h3>
          <p>{t(
            'Nach Maßgabe der DSGVO bestehen Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden (Art. 7 Abs. 3), ohne die Rechtmäßigkeit der vorherigen Verarbeitung zu berühren. Zur Ausübung deiner Rechte genügt eine E-Mail an die oben genannte Adresse. Du kannst dich bei einer Datenschutzaufsichtsbehörde beschweren (Art. 77). PRÜFEN: Die zuständige Aufsichtsbehörde anhand der tatsächlichen Niederlassung bestimmen; eine c/o-Postanschrift allein bestimmt die Zuständigkeit nicht.',
            'Subject to the GDPR, you have rights of access (Article 15), rectification (Article 16), erasure (Article 17), restriction of processing (Article 18), data portability (Article 20) and objection (Article 21). Consent may be withdrawn at any time for the future (Article 7(3)) without affecting the lawfulness of earlier processing. To exercise your rights, email the address above. You may lodge a complaint with a data protection supervisory authority (Article 77). CHECK: Determine the competent authority based on the actual establishment; a c/o mailing address alone does not determine jurisdiction.',
          )}</p>
          <p>{t(
            'Bei Kontaktaufnahme verarbeiten wir übermittelte Kontaktdaten und Nachrichten zur Bearbeitung deines Anliegens. PRÜFEN: Rechtsgrundlage und Löschfristen dieser Kontaktverarbeitung festlegen.',
            'When you contact us, we process the contact details and messages you provide to handle your enquiry. CHECK: Establish the legal basis and retention periods for this contact processing.',
          )}</p>
          <h3>{t('9. Änderungen', '9. Changes')}</h3>
          <p>{t(
            'Bei Änderungen der Website oder der Verarbeitung wird diese Erklärung angepasst. Der jeweils aktuelle Stand ist auf dieser Seite abrufbar.',
            'This notice will be updated when the website or processing changes. The current version is available on this page.',
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
              {' – '}{t('Stationsbeobachtungen mit Quellenvermerk an der Anzeige; in Stationsclustern werden Temperaturwerte gemittelt. Datenbasis: Deutscher Wetterdienst, Einzelwerte gemittelt. Datenbasis: Deutscher Wetterdienst, Wetterwarnungen — Warngebiete zusammengeführt und gefiltert dargestellt. Aktualisierung alle fünf Minuten; Vollständigkeit und Aktualität nicht gewährleistet. ',
                'Station observations with attribution next to the display; temperatures are averaged in station clusters. Data source: Deutscher Wetterdienst, individual values averaged. Data source: Deutscher Wetterdienst, weather warnings — warning areas merged and filtered for display. Updated every five minutes; completeness and timeliness are not guaranteed. ')}
              <a href="https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise.html">{t('Rechtliche Hinweise', 'Legal information')}</a>.</li>
            <li><a href={satelliteSource.sourceUrl}>{satelliteSource.provider}</a>
              {' – '}{t('Diese Anwendung basiert auf EUMETSAT-Meteosat-Daten, Produkt ', 'This service is based on EUMETSAT Meteosat data, product ')}
              <code>{satelliteSource.layer}</code>
              {t(', bereitgestellt über ', ', provided through ')}{satelliteSource.service}.
              {' '}{t('Jahr der Veröffentlichung beziehungsweise Bereitstellung: ', 'Year of publication or distribution: ')}
              {satelliteYear ?? t('Ohne geladenes Satellitenbild nicht bestimmt.', 'Not determined without a loaded satellite image.')}
              {satelliteYear && t(' (UTC-Jahr des angezeigten Datenzeitpunkts).', ' (UTC year of the displayed data timestamp).')}
              {' '}{t('Lizenz: Creative Commons Namensnennung 4.0 International', 'Licensed under Creative Commons Attribution 4.0 International')}
              {' ('}<a href={satelliteSource.licenceUrl}>{satelliteSource.licence}</a>{'). '}
              {t(
                'Eigene Darstellungsänderungen: Kontrast auf 1,9 und Helligkeit auf 1,25 gesetzt; Screen-Mischmodus und einstellbare Deckkraft zur Überblendung mit anderen Kartenebenen. Die meteorologischen Ausgangswerte werden nicht neu berechnet. Technische Darstellung: WMS-PNG8 mit reduzierter Bildauflösung im Kartenclient.',
                'Display changes: contrast set to 1.9 and brightness to 1.25; screen blending and adjustable opacity for blending with other map layers. The original meteorological values are not recalculated. Technical rendering: WMS PNG8 at reduced image resolution in the map client.',
              )}
              {' '}{t(
                'EUMETSAT Legal Affairs bestätigte am 11.11.2026 CC BY 4.0 für EUMETView-Daten einschließlich dieses Layers. Dies bestätigt weder unbegrenzte Dienstzugriffe noch eine Empfehlung, Zertifizierung oder Partnerschaft durch EUMETSAT. Die Datenlizenz gilt nicht automatisch für unseren Anwendungscode.',
                'On 11 November 2026, EUMETSAT Legal Affairs confirmed CC BY 4.0 for EUMETView data including this layer. This does not confirm unlimited service access or imply endorsement, certification or partnership by EUMETSAT. The data licence does not automatically apply to our application code.',
              )}</li>
            <li><a href="https://open-meteo.com/">Open-Meteo</a>
              {' – '}{t('Vorhersagen (DWD ICON) und Ortssuche; ', 'forecasts (DWD ICON) and geocoding; ')}
              <a href="https://open-meteo.com/en/licence">CC BY 4.0</a>
              {' · '}<a href="https://open-meteo.com/en/terms">{t('API-Nutzungsbedingungen', 'API terms')}</a>.
              {' '}{t('Die kostenlose API ist nur für nichtkommerzielle Nutzung vorgesehen; auch Werbung und werbliche Aktivitäten beachten.',
                'The free API is for non-commercial use only; advertising and promotional activities must also be considered.')}</li>
            <li><a href="https://www.zippopotam.us/">Zippopotam.us</a>
              {' – '}{t('deutsche Postleitzahlsuche mit Daten von ', 'German postcode lookup using data from ')}
              <a href="https://www.geonames.org/">GeoNames</a>.</li>
            <li><a href="https://www.geonames.org/">GeoNames</a>
              {' – '}{t('Ortsdaten der Open-Meteo-Ortssuche; ', 'location data used by Open-Meteo geocoding; ')}
              <a href="https://www.geonames.org/export/">{t('Attributions- und Lizenzhinweise', 'attribution and licence information')}</a>.</li>
          </ul>
          <p>{t(
            'Die Anpassung der Warnungsanzeige setzt die DWD-Regeln für Quellenvermerke um; sie ist keine abschließende rechtliche Freigabe.',
            'The warning display has been adapted to implement the DWD source attribution rules; this is not final legal clearance.',
          )}</p>
          <p className="legal-draft">{t(
            'Noch offen vor Freigabe: technische EUMETView-Dienstbedingungen, Zugriffslimits und gegebenenfalls Caching-/Proxy-Vorgaben sowie Datenschutz direkter Browserverbindungen; abweichende Datenquellen gesondert prüfen. Außerdem Zippopotam.us-Dienstbedingungen, produktbezogene DWD-Vorgaben insbesondere für Warnungen sowie Herkunft/Lizenz der eingebundenen Deutschland-Geometrie. Eine Quellenangabe ersetzt keine Nutzungserlaubnis.',
            'Still unresolved before clearance: technical EUMETView service terms, access limits and any caching/proxy requirements, plus privacy of direct browser connections; different data sources require separate review. Also Zippopotam.us service terms, product-specific DWD requirements especially for warnings, and provenance/licence of the bundled Germany geometry. Attribution does not replace permission to use a source.',
          )}</p>
          <h3>{t('Software', 'Software')}</h3>
          <p>{t('Verwendet werden unter anderem React, OpenLayers, proj4, geotiff, pngjs und polygon-clipping. ',
            'Software includes React, OpenLayers, proj4, geotiff, pngjs and polygon-clipping. ')}
            <a href="./third-party-notices.txt">{t('Lizenztexte und Hinweise der Produktionsabhängigkeiten', 'Production dependency licence texts and notices')}</a>.
          </p>
          <p>{t(
            'Der eigene Anwendungscode steht unter GNU Affero General Public License, Version 3 oder einer späteren Version (AGPL-3.0-or-later). Wetter- und Kartendaten, Screenshots mit Fremdinhalten und eingebundene Software unterliegen ihren jeweiligen gesonderten Bedingungen. Diese Lizenzwahl erteilt keine zusätzlichen Rechte an fremden Daten.',
            'Our application code is licensed under the GNU Affero General Public License, version 3 or any later version (AGPL-3.0-or-later). Weather and map data, screenshots containing third-party content and included software remain subject to their respective separate terms. This licence choice grants no additional rights to third-party data.',
          )}</p>
          <p><a href="/application-license.txt">{t('AGPL-Lizenztext', 'AGPL licence text')}</a>
            {' · '}<a href="/application-source.tar.gz" download>{t('Quellcode dieser Version herunterladen', 'Download the source code of this version')}</a></p>
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
