import { mkdir, writeFile } from 'node:fs/promises'
import { PNG } from 'pngjs'

const output = new URL('../public/', import.meta.url)
await mkdir(output, { recursive: true })
const icons = [180, 192, 512]
for (const size of icons) {
  const image = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const sun = Math.hypot(u - 0.41, v - 0.39) < 0.145
      const cloud = Math.hypot(u - 0.43, v - 0.53) < 0.12 ||
        Math.hypot(u - 0.56, v - 0.47) < 0.16 ||
        Math.hypot(u - 0.68, v - 0.55) < 0.10 ||
        u > 0.42 && u < 0.68 && v > 0.51 && v < 0.65
      const rain = [0.43, 0.56, 0.69].some((drop) =>
        v > 0.70 && v < 0.79 && Math.abs(u - drop + (v - 0.70) * 0.35) < 0.016)
      const color = cloud ? [233, 242, 250] : sun ? [255, 209, 102] : rain ? [72, 185, 223] : [11, 31, 51]
      const index = (y * size + x) * 4
      image.data.set([...color, 255], index)
    }
  }
  await writeFile(new URL(`app-icon-${size}.png`, output), PNG.sync.write(image))
}
await writeFile(new URL('manifest.webmanifest', output), JSON.stringify({
  id: '/',
  name: 'Wetterkarte Europa',
  short_name: 'Wetterkarte',
  description: 'Interaktive Wetterkarte / Interactive weather map',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#071521',
  theme_color: '#0b1f33',
  icons: [192, 512].flatMap((size) => ['any', 'maskable'].map((purpose) => ({
    src: `/app-icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose,
  }))),
}, null, 2) + '\n')
console.log('Created home-screen manifest and app icons.')
