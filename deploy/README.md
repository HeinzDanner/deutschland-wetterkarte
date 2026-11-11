# Serverbereitstellung (Beta)

Vorbereitet, aber noch nicht auf einem Server eingerichtet. Ziel ist eine
einzelne Instanz mit Docker Compose v2: Caddy liefert das gebaute Frontend
und leitet `/api/*` intern an Node weiter. Nur Caddy ist von aussen erreichbar.
Ein Nutzerkonto ist nicht erforderlich.

**Kein Zugangsschutz:** Die folgende Standardkonfiguration ist nach DNS- und
Firewall-Freigabe oeffentlich erreichbar, auch wenn sie als Beta bezeichnet
wird. Fuer einen geschuetzten Testbetrieb vor dem Start einen geeigneten
Zugangsschutz einrichten und aus einem fremden Netz pruefen. HTTPS allein
beschraenkt den Zugriff nicht.

## Passwortgeschuetzter Test

Das optionale `compose.private.yaml` schuetzt Website und API gemeinsam mit
Caddy Basic Auth. Alle Compose-Befehle fuer diesen Test muessen beide Dateien
angeben; die Standardkonfiguration allein ist nicht geschuetzt. Basic Auth
verhindert keine automatisierten Passwortversuche: ein langes, einmaliges
Passwort verwenden und den Zugang bei Bedarf zusaetzlich per Firewall begrenzen.

Im Projektordner auf dem Server `.env` mit restriktiven Rechten anlegen.
`SITE_ADDRESS` muss eine Domain ohne Schema sein, die auf diesen Server zeigt;
kein `http://` verwenden. Das Passwort nicht in die Shell-History schreiben.
Einen bcrypt-Hash interaktiv erzeugen:

```sh
sudo docker run --rm -it caddy:2-alpine caddy hash-password
```

In `.env` eintragen, dabei den Hash durch die Ausgabe ersetzen und die einfachen
Anfuehrungszeichen beibehalten, damit Compose die Dollarzeichen nicht auswertet:

```text
SITE_ADDRESS=weather.example.com
BASIC_AUTH_USER=tester
BASIC_AUTH_HASH='$2a$HASH_AUS_CADDY'
```

Die Datei darf nicht geteilt oder committed werden. Beispielsweise mit
`chmod 600 .env` den Zugriff einschraenken. Nicht `docker compose config`
ohne `--quiet` ausgeben, da es den Hash anzeigen kann.

```sh
docker compose -f compose.yaml -f compose.private.yaml config --quiet
docker compose -f compose.yaml -f compose.private.yaml up -d --build
docker compose -f compose.yaml -f compose.private.yaml ps
```

Nach Zertifikatausstellung ausschliesslich HTTPS verwenden. Ohne Anmeldung
muessen sowohl `/` als auch `/api/health` HTTP 401 liefern; mit Anmeldung
muss die Website funktionieren und `/api/health` HTTP 200 liefern. Auch von
einem anderen Netz pruefen. Falls die Anmeldung nicht wie erwartet greift,
den Web-Container sofort stoppen:

```sh
docker compose -f compose.yaml -f compose.private.yaml stop web
```

Die folgenden allgemeinen Start-, Log- und Update-Befehle beziehen sich auf die
ungeschuetzte Standardkonfiguration. Fuer den privaten Test jeweils
`-f compose.yaml -f compose.private.yaml` ergaenzen, insbesondere bei Updates
und Neustarts, damit nicht versehentlich der Schutz entfernt wird.

## Voraussetzungen

- Linux-Server mit Docker Engine und Compose v2, Git und einer Domain.
- Als Startpunkt fuer die Erprobung: 2 vCPU und 4 GB RAM, ausreichend freier
  Plattenplatz fuer Docker-Images und Builds. Dies ist keine gemessene
  Kapazitaetszusage; OPERA-Aufbereitung und parallele Nutzer noch unter Last pruefen.
- DNS A-Eintrag (und nur bei funktionierendem IPv6 ein AAAA-Eintrag) zum Server.
- Eingehend TCP 80/443, optional UDP 443 fuer HTTP/3; SSH eingeschraenkt.
  Port 8787 wird nicht veroeffentlicht.
- Ausgehendes HTTPS zu den Wetterdatenquellen und Kartenanbietern.
  Ports 80/443 duerfen nicht bereits durch einen anderen Webserver belegt sein.

## Erster Start auf dem kuenftigen Server

Im geklonten Projektordner `.env.example` nach `.env` kopieren und
`SITE_ADDRESS` auf die eigene Domain setzen (ohne Schema oder Pfad).
Danach:

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 api web
```

Caddy besorgt und erneuert Zertifikate automatisch, sobald Domain, DNS und
Erreichbarkeit stimmen. Unter `https://DEINE-DOMAIN/` liegt die App;
`https://DEINE-DOMAIN/api/health` muss HTTP 200 liefern.
Frontend und API teilen sich die Adresse, es ist kein CORS erforderlich.
Nicht den Vite-Entwicklungsserver oder `vite preview` oeffentlich betreiben.

Fuer einen Docker-Probelauf ohne Domain kann `.env` voruebergehend
`SITE_ADDRESS=http://localhost` enthalten. Dann ist `http://localhost`
erreichbar, ohne Zertifikat. Diesen Wert nicht fuer die oeffentliche Domain
beibehalten.

## Betrieb

- `restart: unless-stopped` startet abgestuerzte Container nach einem Fehler
  oder Host-Neustart wieder, sofern Docker beim Booten startet.
  Ein lediglich als `unhealthy` markierter Container wird von Compose
  **nicht** automatisch neu gestartet: externen Healthcheck/Alarm einrichten.
- `/api/health` prueft nur, ob der API-Prozess antwortet, nicht ob DWD,
  OPERA oder Open-Meteo verfuegbar sind. Vor Freigabe echte Radar-, Such-,
  Vorhersage- und Warnungsabrufe pruefen.
- Backend-Logs: `docker compose logs -f --tail=100 api`.
  Container-Logs rotieren (3 Dateien zu je 10 MB). Caddy-Zugriffslogging
  ist nicht aktiviert; Provider-/Proxy-Logs gesondert beachten.
- Die API begrenzt global auf 32 gleichzeitige Anfragen und 1200 Anfragen
  je Minutenfenster, danach HTTP 429 mit `Retry-After`.
  Der Healthcheck ist ausgenommen. Diese groben Ein-Instanz-Limits ersetzen
  weder nutzerbezogene Limits noch DDoS-Schutz; bei Missbrauch kann ein Nutzer
  das gemeinsame Kontingent verbrauchen. Vor groesserer Freigabe Last und
  Upstream-Kontingente messen und gegebenenfalls vorgeschalteten Schutz waehlen.
- API: maximal 1536 MB RAM, zwei CPU-Kerne, 128 Prozesse; Web: 256 MB RAM.
  Ein Speicherlimit kann einen Neustart ausloesen. Verbrauch mit
  `docker stats` beobachten, insbesondere bei kaltem Radar-Cache.
- Node laeuft im API-Container ohne Root-Rechte. Nur ein API-Replikat
  betreiben: Caches, Limits und die Historien-Datei sind nicht verteilt.
- Die Stationshistorie liegt im benannten Volume `station_history` unter
  `/app/data/station-outages.json`. Sie ueberlebt Container-Neubauten.
  `docker compose down --volumes` wuerde diese Daten und Zertifikate loeschen:
  nicht fuer normale Updates verwenden.

## Updates und Sicherung

Vor einem Update den verwendeten Commit notieren und die Historie sichern:
Zielordner `backups` lokal anlegen, dann bei laufendem API-Container:

```sh
docker compose cp api:/app/data/station-outages.json backups/station-outages.json
git pull --ff-only
docker compose up -d --build
docker compose ps
```

Die Datei existiert erst nach dem ersten Stationsabruf. Nicht vorhandene Datei
ist daher anfangs normal. Backups ausserhalb des Servers aufbewahren und
Wiederherstellung erproben. Optional kann die bisherige lokale Historie vor
dem ersten Stationsabruf in den Server-Container kopiert werden. Dabei API
anhalten, damit keine gleichzeitigen Schreibzugriffe stattfinden; Dateirechte
fuer den Container-Nutzer `node` beibehalten. Ohne Import beginnt dort eine
neue Historie.

## Vor der oeffentlichen Freigabe noch offen

- Die Website verlinkt Impressum, Datenschutz, Quellen/Lizenzen und Wetterhinweise
  im Footer (auch direkt als `/#impressum`, `/#datenschutz`, `/#quellen`,
  `/#wetterhinweise` erreichbar, ohne zusaetzliche Server-Routen).
  Impressum und Datenschutz sind ausdruecklich **Entwuerfe**, keine Freigabe.
  Oeffentliche Betreiberangaben in `src/legalConfig.ts` pruefen; diese Werte
  landen im ausgelieferten Frontend und gegebenenfalls im oeffentlichen Repository.
  Niemals Zugangsdaten oder persoenliche Steuernummern dort eintragen.
  Fuer den vorgesehenen Hetzner-Server in Falkenstein ist laut Betreiber ein
  AV-Vertrag abgeschlossen; Vertragsgesellschaft, tatsaechliche Logs und
  Loeschfristen noch anhand des konkreten Betriebs pruefen.
  Entwurfshinweise in `src/LegalPages.tsx` erst nach inhaltlicher Pruefung entfernen.
- Betreiberangaben und Rechtstexte nach Entwurf eingefuegt; rechtliche Pruefung
  bleibt offen. Impressum und Datenschutz verwenden dieselbe oeffentliche
  c/o-Anschrift aus `src/legalConfig.ts` in beiden Sprachen. Die c/o-Anschrift
  bestimmt nicht automatisch die zustaendige Datenschutzaufsichtsbehoerde.
  Nach dem ersten Produktionsstart mit `docker compose logs --tail=200 api`
  oder `docker logs` pruefen, ob IP-Adressen in Backend-Logs auftauchen;
  gegebenenfalls Abschnitt 3 der Datenschutzerklaerung ergaenzen.
  Fehlende IP-Adressen in einer Stichprobe beweisen nicht, dass sie bei
  anderen Anfragen oder Fehlern niemals protokolliert werden.
  Nach Adressaenderungen neu bauen und deployen: alte Images, Quellarchive
  und Git-Historie werden dadurch nicht rueckwirkend bereinigt.
- `npm run notices` erzeugt `public/third-party-notices.txt` aus den installierten
  Produktionsabhaengigkeiten; `npm run build` fuehrt dies automatisch aus.
  Fehlende Lizenztexte brechen die Erzeugung ab und muessen geprueft werden.
  Nach Abhaengigkeitsaenderungen die Datei aktualisieren und mit ausliefern.
- Die freiwillige localStorage-Einstellungsspeicherung, lokale Dokumentation der
  Entscheidung und direkte Browserabrufe bei OSM/EUMETSAT rechtlich pruefen.
  Die lokale Entscheidung ist kein unabhaengiger serverseitiger Nachweis.
- EUMETSAT Legal Affairs hat am 11.11.2026 CC BY 4.0 fuer EUMETView-Daten
  einschliesslich `msg_fes:ir108` bestaetigt. Frontend und Backend verwenden
  diesen Layer am WMS `https://view.eumetsat.int/geoserver/ows`.
  Attribution und Lizenzlink sind umgesetzt; das UTC-Jahr des geladenen
  Bildzeitpunkts liefert das Datenjahr. Ohne geladenes Bild bleibt es unbekannt.
  Kontrast/Helligkeit und einstellbare Ueberblendung sind dokumentiert.
  Die Bestaetigung ersetzt keine Pruefung technischer Dienstbedingungen,
  Zugriffslimits, Caching-/Proxy-Vorgaben und direkter Browserverbindungen.
  Sie ist keine Website-Freigabe oder Aenderung der eigenen Code-Lizenz.
- Quellen/Lizenzen nennt offene Zippopotam.us-, DWD-Produkt- und
  Deutschland-Geometrie-Pruefungen. Der eigene Anwendungscode steht unter
  AGPL-3.0-or-later; Daten und Fremdsoftware behalten gesonderte Bedingungen.
  `npm run build` erzeugt einen oeffentlichen Quellcode- und Lizenzdownload
  unter `/application-source.tar.gz` und `/application-license.txt`.
  Beide Downloads und den Link unter Quellen/Lizenzen nach jedem Deployment
  pruefen. Das Archiv enthaelt auch Backend und Build-/Deploymentdateien,
  aber keine `.env` oder privaten Schluessel. Oeffentliche Betreiberangaben
  in `src/legalConfig.ts` sind dagegen bewusst enthalten.
- Recherche zu Datenbedingungen (keine Freigabe):
  - DWD Open Data verweist fuer die POI-Stationsdateien auf
    https://www.dwd.de/copyright. Fuer Warnungen nennt
    https://www.wettergefahren.de/vorlagen_quellenangabe.html besondere
    Vorgaben zu vollstaendiger und unverzueglicher Bereitstellung. Die Anwendung
    filtert Warnungen, aktualisiert den Browser alle fuenf Minuten und kann bei
    Fehlern keine Echtzeitverfuegbarkeit garantieren. Umsetzung der DWD-Regeln
    fuer Quellenvermerke, ohne abschliessende rechtliche Freigabe: Unmittelbare
    Quellenvermerke der Warnungsanzeige wurden entfernt; ein sichtbarer Hinweis
    grenzt die eigene Darstellung vom amtlichen Warnkanal ab und verlinkt auf
    offizielle Warnungen. Datenbasis und Bearbeitung stehen auf der Quellen-Seite
    und im Impressum. Stations-Quellenvermerke bleiben unveraendert. Optional
    schriftliche Bestaetigung ueber opendata@dwd.de anfragen.
  - https://docs.zippopotam.us/docs/getting-started/ nennt GeoNames als Quelle
    aller Daten und beschreibt sie als ohne Gewaehr. GeoNames erwartet eine
    Quellenangabe: https://www.geonames.org/export/. Die App nennt beide Anbieter;
    die Startseite https://docs.zippopotam.us/ nennt keine festen Limits. Das ist
    keine Verfuegbarkeitsgarantie; weitere Dienstbedingungen bleiben zu klaeren.
  - OSM-Kacheln: https://operations.osmfoundation.org/policies/tiles/ verlangt
    u. a. sichtbare Attribution, Referer und Caching; Browser-/Caddy-Verhalten
    sowie Kapazitaet unter der echten Domain vor Freigabe pruefen.
  - `src/data/germany.json` wird fuer den standardmaessig ausgeschalteten
    DWD-Radar-Fallback eingebunden; die Herkunft ist nicht nachgewiesen und
    die Datei ist trotzdem Teil des Projekts. Vor oeffentlichem Repository und
    Auslieferung Provenienz/Lizenz klaeren oder geeignet ersetzen.
- Container-Build und HTTPS auf dem Zielserver tatsaechlich pruefen.
- Kalten Radarstart, mehrere parallele Browser, Fehlerzustaende und
  Erreichbarkeit vom Handy ueber Mobilfunk erproben.
- Externes Monitoring, Backups, Betriebssystem-/Image-Updates organisieren.
- Nutzungsbedingungen und Kontingente von Open-Meteo, OSM, EUMETSAT, DWD,
  OPERA und Zippopotam.us fuer den konkreten Betrieb pruefen; eine technisch
  oeffentliche Quelle ist nicht automatisch unbegrenzt kommerziell nutzbar.
- Impressum/Datenschutzhinweise und Attributionen fuer den Betreiber klaeren:
  Karten-/Satellitenabrufe gehen zum Teil direkt vom Browser an Dritte.
  Diese Vorbereitung ist keine rechtliche Pruefung oder Sicherheitsfreigabe.
- Keine Offline-Verfuegbarkeit oder Push-Warnungen zugesichert; noch keine PWA.
