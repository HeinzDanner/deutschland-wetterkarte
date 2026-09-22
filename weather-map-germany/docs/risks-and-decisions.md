# Risiken und Entscheidungen

## No-Go in V1
- kein GeoServer/PostGIS
- keine historische Wetterdatenhaltung
- keine komplexe Auth/Benutzerlogik
- kein Monster-Endpunkt `/api/weather/all`

## Hauptentscheidungen
- kleines, fachlich benanntes BFF
- stabile Antworthülle (`data`, optional `meta`, optional `errors`)
- Providerwissen bleibt im BFF
