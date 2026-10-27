import ImageWMS from 'ol/source/ImageWMS'
import { unByKey } from 'ol/Observable'
import type { Extent } from 'ol/extent'
import type Projection from 'ol/proj/Projection'

const MAX_PARALLEL_LOADS = 4
const MAX_ATTEMPTS = 3
const LOAD_TIMEOUT_MS = 30000

export type RadarBufferOptions = {
  format?: string
  maxParallel?: number
}

export function createRadarBuffer(
  url: string,
  layer: string,
  extent: Extent,
  resolution: number,
  pixelRatio: number,
  projection: Projection,
  options: RadarBufferOptions = {},
) {
  const maxParallel = options.maxParallel ?? MAX_PARALLEL_LOADS
  const cache = new Map<string, Promise<ImageWMS>>()
  const controller = new AbortController()
  const queue: { time: string; start: () => void }[] = []
  let running = 0

  function attempt(time: string, urgent: boolean): Promise<ImageWMS> {
    return new Promise<ImageWMS>((resolve, reject) => {
      const start = () => {
        if (controller.signal.aborted) {
          reject(new DOMException('Radarbuffer verworfen', 'AbortError'))
          return
        }
        running += 1
        const source = new ImageWMS({
          url,
          params: {
            LAYERS: layer,
            VERSION: '1.3.0',
            TIME: time,
            ...(options.format ? { FORMAT: options.format } : {}),
          },
          ratio: 1,
          serverType: 'geoserver',
          crossOrigin: 'anonymous',
        })
        let settled = false
        const finish = (error?: Error) => {
          if (settled) return
          settled = true
          window.clearTimeout(timeout)
          unByKey(listeners)
          controller.signal.removeEventListener('abort', abort)
          running -= 1
          if (error) reject(error)
          else resolve(source)
          queue.shift()?.start()
        }
        const abort = () => finish(new DOMException('Radarbuffer verworfen', 'AbortError'))
        const timeout = window.setTimeout(
          () => finish(new Error('Zeitlimit beim Laden des Radarbilds überschritten.')), LOAD_TIMEOUT_MS,
        )
        const listeners = [
          source.once('imageloadend', () => finish()),
          source.once('imageloaderror', () => finish(new Error('DWD-Radarbild konnte nicht geladen werden.'))),
        ]
        controller.signal.addEventListener('abort', abort, { once: true })
        const image = source.getImage(extent, resolution, pixelRatio, projection)
        if (image) image.load()
        else finish(new Error('Radarbild für den Kartenausschnitt ist nicht verfügbar.'))
      }
      if (running < maxParallel) start()
      else if (urgent) queue.unshift({ time, start })
      else queue.push({ time, start })
    })
  }

  function load(time: string, urgent = false): Promise<ImageWMS> {
    const cached = cache.get(time)
    if (cached) {
      // A frame that is needed now jumps ahead of background prefetching.
      const index = queue.findIndex((entry) => entry.time === time)
      if (urgent && index > 0) queue.unshift(...queue.splice(index, 1))
      return cached
    }

    // The first requests often hit a cold or busy server, so a failed load is retried before giving up.
    const result = (async () => {
      for (let tries = 1; ; tries += 1) {
        try {
          return await attempt(time, urgent || tries > 1)
        } catch (error) {
          if (controller.signal.aborted || tries >= MAX_ATTEMPTS) throw error
        }
      }
    })()
    cache.set(time, result)
    void result.catch(() => {
      if (cache.get(time) === result) cache.delete(time)
    })
    return result
  }

  return {
    load,
    retain(times: string[]) {
      const retained = new Set(times)
      for (const time of cache.keys()) {
        if (!retained.has(time)) cache.delete(time)
      }
    },
    dispose() {
      controller.abort()
      while (queue.length > 0) queue.shift()?.start()
      cache.clear()
    },
  }
}
