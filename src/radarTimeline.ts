export function retainedRadarIndex(frames: string[], selected?: string) {
  if (!selected) return frames.length - 1
  const exact = frames.indexOf(selected)
  if (exact !== -1) return exact
  const target = Date.parse(selected)
  return frames.reduce((nearest, frame, index) =>
    Math.abs(Date.parse(frame) - target) < Math.abs(Date.parse(frames[nearest]) - target)
      ? index : nearest, 0)
}
