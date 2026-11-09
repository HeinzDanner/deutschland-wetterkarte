# Wetterkarte Europa

**Interaktive Wetterdaten auf einer gemeinsamen Karte – von europäischen Radar-Rohdaten bis zur lokalen Vorhersage.**

Eine Full-Stack-Webanwendung mit React, TypeScript und OpenLayers sowie einem schlanken Node.js-Backend. Sie verbindet Niederschlagsradar, Satellitenbilder, Stationsmessungen und amtliche DWD-Warnungen mit einer steuerbaren Zeitleiste.

Der technische Schwerpunkt liegt nicht nur auf der Visualisierung: Die Anwendung verarbeitet GeoTIFF-Radardaten zu PNGs, koordiniert asynchrone Bildabrufe und führt Warngeometrien zusammen, ohne deren ursprüngliche lokale Informationen zu verlieren.

**Status:** funktionsfähige Entwicklungsversion mit vorbereiteter Container-Bereitstellung. Eine öffentlich betriebene Demo ist hier noch nicht verlinkt. Rechtliche und betriebliche Freigabepunkte sind offen; das Projekt beansprucht keine Produktionsfreigabe.

[Einblicke](#einblicke) · [Funktionen](#funktionen) · [Architektur](#architektur) · [Lokal starten](#lokal-starten) · [Tests](#tests-und-qualitätsprüfung) · [Deployment](#deployment) · [Lizenzen](#datenquellen-und-lizenzen)

## Einblicke

![Desktopansicht mit europäischem Niederschlagsradar, Stationswerten und geöffneter Stationsvorhersage](docs/screenshots/europa-uebersicht.png)

*Vom europäischen Wettergeschehen zur lokalen Messung: Radar, deutsche Stationswerte und eine geöffnete Vorhersage im selben Kartenkontext.*

<sub>Karte: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Radar: [EUMETNET OPERA](https://eumetnet.github.io/openradardata-documentation/1-ORD-API-overview/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), farblich aufbereitet und reprojiziert. Stationswerte/Warnflächen: DWD. Vorhersage: [Open-Meteo](https://open-meteo.com/), DWD ICON, CC BY 4.0, als Diagramm aufbereitet.</sub>

### Radar und Satellit im zeitlichen Vergleich

![Radar und Infrarot-Satellitenbild mit gemeinsamer Zeitleiste und sichtbarem Datenzeitpunkt](docs/screenshots/radar-satellit-synchron.png)

*Gemeinsame verfügbare Zeitpunkte statt eines Vergleichs unterschiedlich alter Bilder.*

<sub>Karte: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Radar: [EUMETNET OPERA](https://eumetnet.github.io/openradardata-documentation/1-ORD-API-overview/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), farblich aufbereitet und reprojiziert. Satellit: EUMETSAT Meteosat, Kontrast/Helligkeit und Überblendung angepasst. Stationswerte/Warnflächen: DWD.</sub>

### Warngebiete mit lokalem Kontext

![Schraffierte DWD-Warngebiete mit geöffnetem Originalwarntext und Gültigkeitsangaben](docs/screenshots/warngebiete-details.png)

*Zusammengeführte Warnflächen für den Überblick, ursprüngliche lokale Warntexte für die Details.*

<sub>Karte: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Warnungen und Stationswerte: Deutscher Wetterdienst; Warnflächen für die Darstellung zusammengeführt und schraffiert.</sub>

Die Aufnahmen vom **9. November 2026** zeigen den damaligen Datenstand, keine
aktuelle Wetterlage. Die Quellenhinweise gelten jeweils für die dargestellten
Daten; vor öffentlicher Veröffentlichung sind insbesondere die noch offenen
EUMETSAT-Bildnutzungsbedingungen zu klären (siehe [Datenquellen und Lizenzen](#datenquellen-und-lizenzen)).

## Funktionen

| Bereich | Umsetzung |
| --- | --- |
| **Europa-Radar** | EUMETNET OPERA RATE-Komposit mit 2-km-Raster, Farbskala in mm/h, verfügbaren 15-Minuten-Zeitpunkten und bis zu 13 Bildern aus den letzten vier Stunden. |
| **Satellit** | EUMETSAT-Meteosat-Infrarotbilder mit Zeitleiste und einstellbarer Deckkraft. |
| **Gemeinsame Wiedergabe** | Radar und Satellit anhand tatsächlich gemeinsamer Zeitpunkte abspielen; die nächste Wiedergabestufe wartet auf beide Bilder. |
| **Stationsnetz** | 100 ausgewählte deutsche DWD-Stationen mit Temperatur, Luftfeuchte und Wind; Cluster mit Durchschnittstemperatur und Zoom zu Einzelstationen. |
| **Amtliche Warnungen** | DWD-Warnflächen mit Schraffur, Schweregrad und Beschriftung; Originaltexte, Gültigkeit und lokale Zuordnung per Klick. Die Warnabdeckung ist Deutschland, nicht ganz Europa. |
| **Ortssuche** | Europäische Länderauswahl mit Deutschland als Vorauswahl, Ortsnamen sowie deutsche Postleitzahlen. Treffer zeigen Region und Land. |
| **Punktvorhersage** | 24-Stunden-Verlauf und Sieben-Tage-Ausblick für Suchtreffer, Stationen oder Kartenklicks über Open-Meteo/DWD ICON, mit lokaler Zeitzone. Verfügbarkeit abhängig vom Datenanbieter. |
| **Bedienung** | Deutsche und englische Oberfläche, responsive Kartenansicht, einklappbare mobile Bedienelemente und optional gespeicherte Karteneinstellungen. |
| **Transparenz** | Sichtbare Kartenattribution, Quellen-/Lizenzübersicht, Wetterhinweise und ausdrücklich gekennzeichnete Entwürfe für Impressum und Datenschutz. |

Die geografische Abdeckung unterscheidet sich je nach Quelle. Eine europaweite Ortssuche bedeutet weder flächendeckende Radarversorgung noch europaweite Stations- oder Warnungsdaten.

## Architektur

```mermaid
flowchart LR
    Browser["Browser · React / TypeScript / OpenLayers"]
    Web["Caddy · statische Dateien / HTTPS"]
    API["Node.js BFF · /api/*"]
    Radar["EUMETNET OPERA · GeoTIFF"]
    DWD["DWD · Stationen / Warnungen"]
    Search["Open-Meteo / GeoNames / Zippopotam.us"]
    Tiles["OpenStreetMap · Kartenkacheln"]
    Satellite["EUMETSAT · Satelliten-WMS"]
    History["JSON · Stations-Ausfallhistorie"]

    Browser --> Web
    Web --> API
    API --> Radar
    API --> DWD
    API --> Search
    API --> History
    Browser --> Tiles
    Browser --> Satellite
```

In der lokalen Entwicklung ersetzt der Vite-Devserver Caddy und leitet `/api` an das Backend weiter. Für den Serverbetrieb sind Frontend und API unter derselben Domain vorgesehen.

**Bewusste Begrenzung:** eine Backend-Instanz, prozesslokale Caches und keine Anwendungsdatenbank. Nur die Stations-Ausfallhistorie wird als JSON-Datei persistiert. Es gibt keine Benutzerkonten.

### Technische Entscheidungen

**Radar-Aufbereitung statt bloßer Bildweiterleitung.** Das Backend liest die OPERA-GeoTIFFs mit `geotiff`, ordnet Niederschlagsraten einer gemeinsamen Farbskala zu und erzeugt mit `pngjs` transparente PNGs. Projektionsinformationen werden an den Client übergeben; `proj4` und OpenLayers übernehmen die Karteneinpassung. Die Anzeige interpoliert Bilder, erhöht damit aber nicht die Messauflösung.

**Request-Coalescing und begrenzte Parallelität.** Gleichzeitige Abrufe desselben Radarzeitpunkts teilen ein gespeichertes Promise. Dadurch läuft die Aufbereitung dieses Bildes nicht mehrfach parallel. Maximal zwei Konvertierungen laufen gleichzeitig; fehlgeschlagene Einträge werden entfernt, damit erneute Versuche möglich bleiben. Das ist eine Ein-Prozess-Lösung, kein verteilter Cache oder allgemeiner Schutz vor Race Conditions.

**Zeitliche Konsistenz.** Die gemeinsame Wiedergabe verwendet die exakte Schnittmenge der Radar- und Satellitenzeitpunkte, keine ersatzweise „nahegelegenen“ Bilder. Langsame Abrufe bremsen die Wiedergabe; Ladefehler stoppen sie mit einer Meldung. Die Ebenen laden ihre Bilder separat – ein atomarer gemeinsamer Bildtausch wird nicht zugesichert. Bei einer automatischen Radaraktualisierung bleibt die Auswahl erhalten oder wechselt zum nächstgelegenen noch verfügbaren Zeitpunkt.

**Warnflächen ohne Gemeinde-Raster.** `polygon-clipping` vereinigt benachbarte Flächen nur bei übereinstimmenden inhaltlichen Warnmerkmalen. Löcher und getrennte Teilflächen bleiben erhalten. Die ursprünglichen Geometrien dienen weiterhin der Trefferprüfung, damit ein Klick den passenden lokalen Warntext liefert.

**Fehlende Werte bleiben fehlend.** Messlücken erscheinen als „–“ statt als Null und unterbrechen Diagrammlinien. Nicht verfügbare Stationen werden gesondert ausgewiesen. Eine persistente Historie dokumentiert Stationsausfälle und Wiederherstellungen bei tatsächlichen Datenaktualisierungen; sie ist kein kontinuierlicher Überwachungsdienst.

## Technologie

| Schicht | Bausteine |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Karte und Geometrie | OpenLayers, proj4, polygon-clipping |
| Backend | Node.js, native HTTP- und Fetch-APIs, ES-Module |
| Rasterverarbeitung | geotiff, pngjs |
| Automatisierte Tests | Node.js Test Runner, `node:assert` |
| Bereitstellung | Docker-Multistage-Build, Docker Compose, Caddy |

## Lokal starten

Voraussetzungen: **Node.js 24** mit npm, eine lokale Kopie dieses Repositorys und Internetzugang zu den Datenanbietern.

Im Projektverzeichnis einmalig die Abhängigkeiten installieren:

```sh
npm ci
```

Anschließend zwei Terminals im selben Verzeichnis öffnen:

```sh
# Terminal 1: Backend
npm run api
```

```sh
# Terminal 2: Frontend
npm run dev
```

Die Anwendung ist standardmäßig unter **http://localhost:5173** erreichbar, das Backend unter **http://localhost:8787**. Sollte Vite einen anderen Port wählen, gilt die ausgegebene Adresse.

Für den aktuellen Entwicklungsstand müssen keine API-Schlüssel eingetragen werden. Die öffentlichen Dienste unterliegen trotzdem Nutzungsbedingungen und Kontingenten; insbesondere ist der kostenlose Open-Meteo-API-Zugang nicht pauschal für kommerzielle Nutzung freigegeben.

Die Docker-Umgebungsdatei wird für diesen lokalen Start nicht benötigt. Eine abweichende Backend-Portbelegung erfordert auch eine Anpassung des Proxys in `vite.config.ts`.

### Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run api` / `npm start` | Node.js-Backend starten. |
| `npm run dev` | Vite-Entwicklungsserver mit API-Proxy starten. |
| `npm test` | Automatisierte Tests ausführen. |
| `npm run build` | Software-Lizenzhinweise erzeugen, TypeScript prüfen und Frontend nach `dist` bauen. |
| `npm run notices` | `public/third-party-notices.txt` aus den installierten Produktionsabhängigkeiten aktualisieren. |
| `npm run preview` | Gebautes Frontend lokal ansehen; kein vollständiger Produktionsstart und kein Ersatz für das API-Routing. |

## Tests und Qualitätsprüfung

```sh
npm test
npm run build
```

Die Tests decken unter anderem folgende Invarianten ab:

- Radarschwellen, Farben, transparente Fehlwerte und Projektionsreferenzen.
- Zeitpunkterhalt bei Radaraktualisierungen und exakte gemeinsame Wiedergabezeiten.
- Vereinigung von Warnflächen einschließlich Löchern, getrennter Gebiete und unveränderter Eingangsdaten.
- Filterung abgelaufener, stornierter und nicht öffentlicher Warnungen.
- Länderfilter, deutsche Postleitzahlen sowie Fehler- und Timeoutweitergabe der Ortssuche mit simulierten Upstream-Antworten.
- Persistenz von Stationsausfällen und Wiederherstellungen.
- API-Healthcheck, erlaubte HTTP-Methoden und globale Anfragebegrenzung.

Browserprüfungen für Desktop, Smartphone und Sprachwechsel wurden ergänzend mit Playwright durchgeführt. Eine reproduzierbare Playwright-End-to-End-Suite ist **noch nicht im Repository eingerichtet**. Die automatisierten Tests ersetzen keine Liveprüfung externer Wetterdienste.

## API-Überblick

| GET-Endpunkt | Inhalt |
| --- | --- |
| `/api/health` | Prozessstatus und Laufzeit; keine Aussage über die Erreichbarkeit aller Datenquellen. |
| `/api/radar/europe/times` | Verfügbare OPERA-Zeitpunkte und Farbskala. |
| `/api/radar/europe/frame/:timestamp.json` | Metadaten eines Radarbildes, einschließlich Ausdehnung und Projektion. |
| `/api/radar/europe/frame/:timestamp.png` | Aufbereitetes Radarbild; Zeitstempel in Unix-Millisekunden. |
| `/api/satellite/times` | Verfügbare EUMETSAT-Zeitpunkte. |
| `/api/stations` | Stationswerte, Datenstand und nicht verfügbare Stationen. |
| `/api/warnings` | Aufbereitete DWD-Warnungen mit ursprünglichen Flächen und Texten. |
| `/api/locations/search?q=Paris&country=FR&language=de` | Suche im gewählten Land; Standard `DE`, Sprache `de` oder `en`, zwei bis 100 Suchzeichen. |
| `/api/forecast?lat=48.8566&lon=2.3522` | Punktvorhersage mit automatisch ermittelter lokaler Zeitzone. |

Die gemeinsame Suchländerliste liegt in `src/data/searchCountries.json`. Bei transkontinentalen Staaten gilt die Auswahl für das gesamte Land; einzelne Gebiete können im Geocoding-Datenbestand keine Treffer liefern. Rein numerische Suchen außerhalb Deutschlands werden als nicht unterstützte Postleitzahlsuche abgewiesen.

Der ältere Endpunkt `/api/radar/times` bleibt für die derzeit deaktivierte DWD-Radar-Fallbackfunktion im Code. Die sichtbare Radaransicht verwendet OPERA.

## Projektstruktur

```text
src/
  App.tsx                    Kartenaufbau, Ebenen und gemeinsame Wiedergabe
  OperaRadar.tsx             OPERA-Darstellung, Bildladen und Steuerung
  WeatherWarnings.tsx        Warnflächen, Legende und lokale Details
  warningAreas.ts            Gruppierung und geometrische Vereinigung
  LocationSearch.tsx         Europäische Länderauswahl und Ortssuche
  StationForecast.tsx        Vorhersage und Diagramme
  synchronizedTimeline.ts    Gemeinsame Zeitpunkte
  radarTimeline.ts           Zeitpunkterhalt bei Aktualisierungen
  mapPreferences.ts          Validierte lokale Karteneinstellungen
  i18n.tsx                   Sprachumschaltung
  LegalPages.tsx             Quellen, Wetterhinweise und Rechtstext-Entwürfe
  legalConfig.ts             Öffentliche Betreiberangaben und offene Betriebsdetails
server.mjs                   HTTP-API, Datenabrufe und prozesslokale Caches
opera.mjs                    GeoTIFF-zu-PNG-Pipeline und Request-Coalescing
warnings.mjs                 Abruf und Normalisierung der DWD-Warnungen
location-search.mjs          Länderbeschränkte Suche und deutsche PLZ
station-history.mjs          Persistente Stations-Ausfallhistorie
*.test.mjs                   Automatisierte Tests
scripts/third-party-notices.mjs
                             Sammlung der Software-Lizenzhinweise
deploy/                      Caddy-Konfiguration und Betriebsanleitung
Dockerfile / compose.yaml    Container-Build und Ein-Instanz-Betrieb
```

## Deployment

Die vorbereitete Serverarchitektur nutzt Caddy für statische Dateien, HTTPS und die Weiterleitung an das interne Backend. Nur die Webports werden veröffentlicht. Der API-Container läuft ohne Root-Rechte; Ressourcenlimits, Logrotation und persistente Volumes für Stationshistorie und Caddy-Daten sind konfiguriert.

**Ein API-Replikat betreiben:** Caches, Anfragegrenzen und die JSON-Historie sind nicht zwischen Instanzen koordiniert. Der globale Schutz von 32 gleichzeitigen Anfragen und 1.200 Anfragen pro Minute ersetzt weder nutzerbezogene Limits noch DDoS-Schutz.

Voraussetzungen, Domain-Konfiguration, Start, Updates und Sicherung sind in der **[Deployment-Anleitung](deploy/README.md)** beschrieben. Container-Build, HTTPS und Wiederherstellung müssen auf dem konkreten Zielsystem noch praktisch abgenommen werden.

## Datenquellen und Lizenzen

| Quelle | Verwendung und zu beachtende Bedingungen |
| --- | --- |
| [EUMETNET OPERA / NIMBUS](https://eumetnet.github.io/openradardata-documentation/1-ORD-API-overview/) | Radar-Komposit, CC BY 4.0; Quellen-, Lizenz- und Bearbeitungshinweise in der Anwendung. |
| [Deutscher Wetterdienst](https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise.html) | Beobachtungen und Warnungen; produktbezogene Vorgaben abschließend prüfen. |
| [EUMETSAT](https://www.eumetsat.int/) | Meteosat-Infrarot über WMS; konkrete Bedingungen des verwendeten Angebots noch zu klären. |
| [Open-Meteo](https://open-meteo.com/en/terms) | Vorhersage und Geocoding. Daten unter CC BY 4.0; kostenlose API nur für nichtkommerzielle Nutzung. Eine beruflich werbliche Portfolio-Nutzung ist nicht automatisch als nichtkommerziell anzunehmen. |
| [GeoNames](https://www.geonames.org/export/) | Ortsdaten über Open-Meteo; Attribution beachten. |
| [Zippopotam.us](https://docs.zippopotam.us/docs/getting-started/) | Deutsche Postleitzahlen auf Basis von GeoNames; genaue Dienstbedingungen noch abschließend prüfen. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Kartendaten unter ODbL; zusätzlich gilt die [Nutzungsrichtlinie des Kachelservers](https://operations.osmfoundation.org/policies/tiles/). |

Die **[Software-Lizenzhinweise](public/third-party-notices.txt)** werden beim Build aus den installierten Produktionsabhängigkeiten erzeugt. Sie ersetzen keine Prüfung der Wetter- und Geodatenlizenzen.

**Eigener Anwendungscode:** Eine Veröffentlichungslizenz wurde noch nicht ausgewählt. Bis dahin wird hier keine allgemeine Erlaubnis zur Weiterverwendung des eigenen Codes erteilt. Daten- und Drittanbieter-Softwarelizenzen gelten unabhängig davon.

## Datenschutz und Grenzen

Kartenkacheln werden direkt vom Browser bei OpenStreetMap geladen, Satellitenbilder bei aktiviertem Layer direkt bei EUMETSAT. Ortssuche und Vorhersage laufen über das Backend; Suchtexte beziehungsweise Koordinaten werden dabei an die jeweiligen Anbieter übermittelt. Ein Backend-Proxy macht diese Informationen nicht automatisch anonym.

Sprache, Kartenausschnitt und Ebeneneinstellungen werden nur nach Zustimmung im `localStorage` gespeichert und gelesen. Die Entscheidung wird lokal mit Zeitpunkt und Textversion gespeichert; sie lässt sich im Seitenfuß jederzeit ändern oder widerrufen, wobei gespeicherte Einstellungen gelöscht werden. Ohne Zustimmung bleiben Änderungen nur während des Besuchs erhalten. Die lokale Entscheidung ist kein unabhängiger serverseitiger Einwilligungsnachweis. Die Einwilligung betrifft nicht direkte Drittanbieterabrufe. Es sind keine Analyse-/Werbesoftware und keine Benutzerkonten eingebunden; die rechtliche Bewertung steht aus.

Impressum und Datenschutz sind über die Anwendung erreichbar, aber **ausdrücklich Entwürfe**. Betreiberangaben in `src/legalConfig.ts` sind öffentlich ausgelieferte Inhalte – dort gehören keine Zugangsdaten oder privaten Steuernummern hinein.

Diese Karte ist **kein amtlicher Warnkanal oder Notfalldienst**. Daten können verspätet, unvollständig oder nicht verfügbar sein. Für sicherheitsrelevante Entscheidungen sind die amtlichen Originalwarnungen maßgeblich. Satelliten-Infrarot zeigt keine Regenintensität; transparente Radarbereiche garantieren keine Niederschlagsfreiheit.

## Vor der öffentlichen Freigabe

- Den früher beobachteten Backend-Absturz bei einem Upstream-Timeout gezielt reproduzieren, beheben und mit Ausfalltests absichern.
- Betreiber-/Kontaktangaben und die Erforderlichkeit weiterer Kontaktmöglichkeiten prüfen; Vertragsgesellschaft, tatsächliches Hosting, Logs und Löschfristen klären und Rechtstexte daran ausrichten.
- Lokale Einstellungsspeicherung und direkte Drittanbieterabrufe datenschutzrechtlich bewerten und gegebenenfalls technisch anpassen.
- Offene Datenbedingungen und die Herkunft/Lizenz der noch eingebundenen Deutschland-Geometrie für den deaktivierten Radar-Fallback klären.
- Umsetzung der [DWD-Regeln für Quellenvermerke](https://www.wettergefahren.de/vorlagen_quellenangabe.html), ohne abschließende rechtliche Freigabe: Die bearbeitete Warnungsanzeige enthält keinen unmittelbaren Quellenvermerk, sondern einen sichtbaren Hinweis auf fehlende Vollständigkeits-/Aktualitätsgarantie und einen Link zu offiziellen Warnungen. Datenbasis und Bearbeitung sind zentral unter Quellen/Lizenzen und im Impressum dokumentiert. Stations-Quellenvermerke bleiben unverändert. Eine schriftliche Bestätigung kann optional über opendata@dwd.de angefragt werden.
- Produktionsinstallation mit HTTPS, Last-/Ausfallverhalten, externer Alarmierung und tatsächlich erprobter Backup-Wiederherstellung abnehmen; Sicherheitsprüfung durchführen.

Diese offenen Punkte sind eine Startcheckliste, keine behauptete behördliche Genehmigungspflicht.

---

**English summary:** An interactive European weather map built with React, TypeScript, OpenLayers and a native Node.js backend. Engineering highlights include GeoTIFF-to-PNG radar processing, in-flight request coalescing, timestamp-based radar/satellite playback, polygon union with preserved local warning details, country-filtered location search and point forecasts. Local setup: Node.js 24, `npm ci`, then `npm run api` and `npm run dev` in separate terminals. This is a working development project with deployment preparation, not a production-cleared service. Application licensing and several legal/operational release checks remain open.
