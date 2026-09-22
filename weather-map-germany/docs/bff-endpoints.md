# BFF Endpunkte (V1)

## Reihenfolge

1. `GET /api/radar/layers`
2. `GET /api/stations`
3. `GET /api/observations/current`
4. `GET /api/forecast/hourly`
5. `GET /api/forecast/daily`
6. `GET /api/pollen` (später)

## Aktuell initialisiert

- `GET /api/radar/layers`
- `GET /api/stations`
- `GET /api/observations/current`

## Antworthülle

- `data` (Pflicht)
- `meta` (optional)
- `errors` (optional)
