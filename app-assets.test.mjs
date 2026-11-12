import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { PNG } from 'pngjs'

test('home-screen assets provide standalone metadata and opaque correctly sized icons', async () => {
  execFileSync(process.execPath, ['scripts/app-assets.mjs'])
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'))
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.id, '/')
  for (const size of [180, 192, 512]) {
    const image = PNG.sync.read(await readFile(`public/app-icon-${size}.png`))
    assert.equal(image.width, size)
    assert.equal(image.height, size)
    for (let index = 3; index < image.data.length; index += 4) assert.equal(image.data[index], 255)
  }
  for (const size of [192, 512]) {
    assert.ok(manifest.icons.some((icon) => icon.sizes === `${size}x${size}` && icon.purpose === 'maskable'))
  }
  const html = await readFile('index.html', 'utf8')
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/)
  assert.match(html, /rel="apple-touch-icon" href="\/app-icon-180.png"/)
})
