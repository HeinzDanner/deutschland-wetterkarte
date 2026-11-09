# Serverbereitstellung (Beta)

Vorbereitet, aber noch nicht auf einem Server eingerichtet. Ziel ist eine
einzelne Instanz mit Docker Compose v2: Caddy liefert das gebaute Frontend
und leitet `/api/*` intern an Node weiter. Nur Caddy ist von aussen erreichbar.
Ein Nutzerkonto ist nicht erforderlich.

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
  Oeffentliche Betreiberangaben in `src/legalConfig.ts` eintragen; diese Werte
  landen im ausgelieferten Frontend und gegebenenfalls im oeffentlichen Repository.
  Niemals Zugangsdaten oder persoenliche Steuernummern dort eintragen.
  Der Betreiber nennt Hetzner als Hoster; Vertragsgesellschaft, gebuchten Standort,
  Auftragsverarbeitung, tatsaechliche Logs und Loeschfristen noch bestaetigen.
  Entwurfshinweise in `src/LegalPages.tsx` erst nach inhaltlicher Pruefung entfernen.
- `npm run notices` erzeugt `public/third-party-notices.txt` aus den installierten
  Produktionsabhaengigkeiten; `npm run build` fuehrt dies automatisch aus.
  Fehlende Lizenztexte brechen die Erzeugung ab und muessen geprueft werden.
  Nach Abhaengigkeitsaenderungen die Datei aktualisieren und mit ausliefern.
- Automatische localStorage-Einstellungen und direkte Browserabrufe bei OSM und
  EUMETSAT auf Rechtsgrundlagen/Einwilligung pruefen; noch kein Consent-Management.
- Quellen/Lizenzen nennt offene EUMETSAT-, Zippopotam.us-, DWD-Produkt- und
  Deutschland-Geometrie-Pruefungen. Auch die eigene Code-Lizenz ist noch offen.
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
