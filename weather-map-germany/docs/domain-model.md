# Domänenmodell (V1)

## Kernmodelle Phase 1
- MapMode
- Station
- CurrentObservation
- RadarLayerConfig
- LayerVisibilityRule

## Danach
- HourlyForecast
- DailyForecast
- WeatherCondition
- WindData
- PrecipitationData
- PollenForecast (später)

## Grundregel
Provider-Rohdaten werden im BFF transformiert; Frontend kennt nur interne Modelle.
