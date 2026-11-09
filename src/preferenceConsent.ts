export const CONSENT_KEY = 'weather-map-preference-consent'
export const LANGUAGE_KEY = 'weather-map-language'
export const PREFERENCE_KEYS = [LANGUAGE_KEY, 'weather-map-view', 'weather-map-layers']
export type ConsentChoice = 'accepted' | 'rejected'
type ConsentRecord = { version: 1; choice: ConsentChoice; decidedAt: string }

export function readConsent(storage: Storage): ConsentRecord | null {
  const raw = storage.getItem(CONSENT_KEY)
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const record = value as Partial<ConsentRecord>
    return record.version === 1 && (record.choice === 'accepted' || record.choice === 'rejected')
      && typeof record.decidedAt === 'string' && Number.isFinite(Date.parse(record.decidedAt))
      ? record as ConsentRecord : null
  } catch {
    return null
  }
}

export function clearPreferences(storage: Storage) {
  for (const key of PREFERENCE_KEYS) storage.removeItem(key)
}

export function setConsent(storage: Storage, choice: ConsentChoice) {
  if (choice === 'rejected') {
    storage.removeItem(CONSENT_KEY)
    clearPreferences(storage)
  }
  const record: ConsentRecord = { version: 1, choice, decidedAt: new Date().toISOString() }
  storage.setItem(CONSENT_KEY, JSON.stringify(record))
  return record
}

export function preferencesAllowed(): boolean {
  try {
    return readConsent(localStorage)?.choice === 'accepted'
  } catch (error) {
    console.warn('Preference consent could not be read:', error)
    return false
  }
}
