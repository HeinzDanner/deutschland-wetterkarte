import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export type LayerPlayback = {
  frames: string[]
  index: number
  playing: boolean
  time: string | null
  loading: boolean
  error: string | null
  select: (index: number) => void
  toggle: () => void
  reload: () => void
}

export function useLayerPlayback({ enabled, playing, count, ready, delay, loop, setIndex }: {
  enabled: boolean
  playing: boolean
  count: number
  ready: boolean
  delay: number
  loop: boolean
  setIndex: Dispatch<SetStateAction<number>>
}) {
  useEffect(() => {
    if (!enabled || !playing || count < 2 || !ready) return
    const timer = window.setTimeout(() => setIndex((index) =>
      loop ? (index + 1) % count : Math.min(index + 1, count - 1)), delay)
    return () => window.clearTimeout(timer)
  }, [enabled, playing, count, ready, delay, loop, setIndex])
}
