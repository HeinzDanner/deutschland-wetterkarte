import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
async function sourceFiles(directory) {
  const files = []
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.env') || /\.(pem|key|tsbuildinfo)$/.test(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Source archive cannot include a symbolic link: ${path}`)
    if (entry.isDirectory()) files.push(...await sourceFiles(path))
    else files.push(path)
  }
  return files
}
const files = [
  'LICENSE', 'README.md', 'package.json', 'package-lock.json',
  'index.html', 'vite.config.ts', 'Dockerfile', '.dockerignore', '.env.example',
  'compose.yaml', 'compose.private.yaml',
  ...await sourceFiles('src'), ...await sourceFiles('scripts'), ...await sourceFiles('deploy'),
  ...(await readdir(root)).filter(name => name.endsWith('.mjs') || /^tsconfig.*\.json$/.test(name)),
]
await mkdir(resolve(root, 'public'), { recursive: true })
await copyFile(resolve(root, 'LICENSE'), resolve(root, 'public', 'application-license.txt'))
const result = spawnSync('tar', [
  '-czf', resolve(root, 'public', 'application-source.tar.gz'), ...files,
], { cwd: root, stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`Source archive creation failed (exit ${result.status}).`)
console.log('Created application source archive and AGPL licence download.')
