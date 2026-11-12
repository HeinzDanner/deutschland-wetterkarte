export function radarErrorMessage(error: string, language: 'de' | 'en'): string {
  const unavailable = error === 'Keine aktuellen OPERA-Niederschlagsbilder verfügbar.'
    || error === 'Keine OPERA-Radarbilder verfügbar.'
  if (unavailable) {
    return language === 'de'
      ? 'Keine aktuellen Radardaten beim Anbieter verfügbar. Die App prüft automatisch erneut. Ältere Bilder werden nicht als aktuell angezeigt.'
      : 'No current radar data is available from the provider. The app will check again automatically. Older images are not shown as current.'
  }
  return language === 'de'
    ? 'OPERA-Radardaten konnten nicht geladen werden. Bitte erneut laden.'
    : 'OPERA radar data could not be loaded. Please reload.'
}
