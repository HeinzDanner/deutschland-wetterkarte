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
          <h3>{t('Verantwortlicher', 'Controller')}</h3>
          <p>{t('Verantwortlich ist der im ', 'The controller is the operator listed in the ')}
            <a href="#impressum">{titles.impressum}</a>.
            {' '}{t('Für Datenschutzanfragen nutze bitte die dort angegebene Kontakt-E-Mail.', 'For privacy enquiries, please use the contact email listed there.')}</p>
          <h3>{t('Hosting und Serverzugriffe', 'Hosting and server requests')}</h3>
          <p>{t(
            'Für den geplanten Betrieb ist ein Server bei Hetzner vorgesehen. Mit dem Hosting-Anbieter wurde ein Auftragsverarbeitungsvertrag abgeschlossen; die genaue Vertragsgesellschaft ist anhand der Unterlagen zu prüfen. Beim Abruf der Website werden insbesondere IP-Adresse, Zeitpunkt, angeforderte URL und technische Browser-/Verbindungsinformationen an den Webserver übermittelt, um die Website auszuliefern und zu schützen.',
            'A server at Hetzner is intended for operation. A data processing agreement has been concluded with the hosting provider; the exact contracting entity must be checked against the contract. Requests transmit in particular an IP address, time, requested URL and technical browser/connection information to the server to deliver and protect the website.',
          )}</p>
          <p>{t('Serverstandort: ', 'Server location: ')}{legalConfig.hostingLocation || missing}<br />
            {t('Protokolle und Löschfristen: ', 'Logs and retention: ')}{legalConfig.loggingAndRetention || missing}</p>
          <p>{t(
            'Die vorbereitete Caddy-Konfiguration aktiviert keine Zugriffsprotokolle. Betriebs- und Fehlerprotokolle sowie etwaige Provider-, Firewall- oder Proxy-Protokolle sind davon zu unterscheiden; der tatsächliche Betrieb ist noch abzugleichen. Empfänger, Rechtsgrundlage und Löschfristen sind vor Freigabe festzulegen.',
            'The prepared Caddy configuration does not enable access logs. Operational and error logs, and any provider, firewall or proxy logs are separate; actual operation still needs to be checked. Recipients, legal basis and retention must be established before clearance.',
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
            'Nur mit deiner Einwilligung speichern und lesen wir im localStorage weather-map-language (Sprache), weather-map-view (Kartenausschnitt) und weather-map-layers (Ebenen und Satellitendeckkraft). Ohne Einwilligung bleiben Änderungen nur im laufenden Besuch erhalten. Du kannst über „Speichereinstellungen“ im Seitenfuß jederzeit widerrufen; gespeicherte Einstellungen werden dabei gelöscht. Die Entscheidung selbst wird mit Zeitpunkt und Version unter weather-map-preference-consent auf diesem Gerät gespeichert, bis du die Website-Daten löschst oder die Entscheidung änderst. Sie wird nicht an unseren Server übertragen. Die App speichert dort keinen Suchverlauf. Der Browser kann Dateien nach HTTP-Cache-Regeln zwischenspeichern.',
            'Only with your consent do we store and read weather-map-language (language), weather-map-view (map view) and weather-map-layers (layers and satellite opacity) in localStorage. Without consent, changes last only for the current visit. You can withdraw using “Storage settings” in the footer; saved preferences are then deleted. The decision itself, including time and version, is stored under weather-map-preference-consent on this device until you delete website data or change the decision. It is not sent to our server. The app does not store search history there. The browser may cache files under HTTP cache rules.',
          )}</p>
          <p>{t(
            'Die Entscheidung zur Einstellungsspeicherung betrifft nicht die direkten Verbindungen zu Dritten. Die App enthält derzeit keine eingebundene Analyse- oder Werbesoftware und keine Benutzerkonten. Rechtsgrundlagen, Nachweis und Angemessenheit der Einwilligung sowie die Verarbeitung durch Dritte sind vor Veröffentlichung zu prüfen.',
            'The preference storage choice does not cover direct third-party connections. The app currently includes no analytics or advertising software and no user accounts. Legal bases, consent evidence and adequacy, and third-party processing must be reviewed before publication.',
          )}</p>
          <p>{t(
            'Serverseitige Caches dienen der Bereitstellung von Wetterdaten. Die Stations-Ausfallhistorie enthält Stationskennungen und Verfügbarkeitsereignisse, keine beabsichtigte Besucherhistorie.',
            'Server-side caches serve weather data. Station outage history contains station identifiers and availability events, not an intended visitor history.',
          )}</p>
          <h3>{t('Kontakt und Rechte', 'Contact and rights')}</h3>
          <p>{t(
            'Bei Kontaktaufnahme werden übermittelte Kontaktdaten und Nachrichten zur Bearbeitung des Anliegens verarbeitet. Rechtsgrundlage und Löschfristen sind vom Betreiber noch festzulegen. Nach Maßgabe der DSGVO bestehen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch; soweit eine Einwilligung verwendet wird, kann sie mit Wirkung für die Zukunft widerrufen werden, ohne die Rechtmäßigkeit der vorherigen Verarbeitung zu berühren. Beschwerden sind bei einer Datenschutzaufsichtsbehörde möglich, insbesondere bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit.',
            'Contact details and messages submitted when contacting the operator are processed to handle the enquiry. The operator must still determine the legal basis and retention. Subject to GDPR conditions, rights include access, rectification, erasure, restriction, portability and objection; any consent may be withdrawn for the future without affecting the lawfulness of prior processing. Complaints may be lodged with a data protection supervisory authority, including the Berlin Commissioner for Data Protection and Freedom of Information.',
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
              {' – '}{t('Stationsbeobachtungen. Datenbasis: Deutscher Wetterdienst, Wetterwarnungen — Warngebiete zusammengeführt und gefiltert dargestellt. Aktualisierung alle fünf Minuten; Vollständigkeit und Aktualität nicht gewährleistet. ',
                'Station observations. Data source: Deutscher Wetterdienst, weather warnings — warning areas merged and filtered for display. Updated every five minutes; completeness and timeliness are not guaranteed. ')}
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
