# Frontend – Deutschland Wetterkarte

React + TypeScript + Vite + OpenLayers Startpunkt für V1.

## Scripts

- `npm run dev` – lokaler Entwicklungsserver
- `npm run build` – Produktionsbuild
- `npm run lint` – Linting

## Struktur

- `src/features/map` – Kartenkern (OpenLayers)
- `src/features/weather-now` – aktueller Wettermodus
- `src/features/stations` – Stationsdarstellung/-auswahl
- `src/services` – BFF-Anfragen
- `src/types` – Domänentypen

## Hinweis

Das Frontend arbeitet nur mit internen BFF-Modellen; Provider-Rohfelder bleiben im BFF.
