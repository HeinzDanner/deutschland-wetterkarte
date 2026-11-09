export function commonFrameTimes(radar: string[], satellite: string[]) {
  const available = new Set(satellite.map(Date.parse))
  return [...new Set(radar.map(Date.parse))]
    .filter((time) => Number.isFinite(time) && available.has(time))
    .sort((a, b) => a - b).map((time) => new Date(time).toISOString())
}
