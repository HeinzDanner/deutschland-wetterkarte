import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'))
const sections = ['Third-party software notices\nProduction dependencies from package-lock.json.\nApplication code and weather/map data have separate terms.\n']
let count = 0
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue
  const directory = resolve(root, path)
  let names
  try {
    names = await readdir(directory)
  } catch (error) {
    if (error.code === 'ENOENT' && entry.optional) continue
    throw error
  }
  const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'))
  const notices = names.filter((name) => /^(licen[cs]e|copying|notice|copyright)([._-].*)?$/i.test(name)).sort()
  const texts = await Promise.all(notices.map(async (name) =>
    `--- ${name} ---\n${await readFile(resolve(directory, name), 'utf8')}`))
  if (!notices.length) {
    const readme = names.find((name) => /^readme\.md$/i.test(name))
    const content = readme ? await readFile(resolve(directory, readme), 'utf8') : ''
    const section = content.match(/^## Licen[sc](?:e|ing)[^\n]*\n([\s\S]*)/m)?.[1]?.split(/^## /m)[0].trim()
    if (!section) throw new Error(`Missing licence text for ${pkg.name}; review the package before distribution.`)
    texts.push(`--- ${readme}: Licensing ---\n${section}`)
    if (pkg.name === 'lerc' && pkg.version === '3.0.0') {
      const source = await readFile(resolve(directory, 'LercDecode.js'), 'utf8')
      const copyright = source.match(/\/\*\s*Copyright[\s\S]*?\*\//)?.[0]
      if (!copyright) throw new Error('Missing LERC source copyright notice.')
      texts.push(copyright, '--- Apache 2.0 full text (also shipped by web-worker) ---\n' +
        await readFile(resolve(root, 'node_modules', 'web-worker', 'LICENSE'), 'utf8'))
    } else if (!section.includes('Permission is hereby granted')) {
      throw new Error(`Review incomplete README licence text for ${pkg.name}.`)
    }
  }
  sections.push(`\n${'='.repeat(72)}\n${pkg.name}@${pkg.version}\nLicence: ${pkg.license || entry.license || 'See included text'}\nSource: ${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || pkg.homepage || 'See package metadata'}\n\n${texts.join('\n\n')}`)
  count++
}
await mkdir(resolve(root, 'public'), { recursive: true })
await writeFile(resolve(root, 'public', 'third-party-notices.txt'), sections.join('\n'), 'utf8')
console.log(`Collected licence notices for ${count} production packages.`)
