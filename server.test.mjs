import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

test('production API exposes health, rejects writes and bounds request volume', { timeout: 30000 }, async () => {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: { ...process.env, PORT: '0', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stderr.on('data', (data) => { output += data })
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`API startup timed out: ${output}`)), 10000)
      const fail = (error) => { clearTimeout(timer); reject(error) }
      child.once('error', fail)
      child.once('exit', (code) => fail(new Error(`API exited with ${code}: ${output}`)))
      child.stdout.on('data', (data) => {
        output += data
        const match = output.match(/http:\/\/localhost:(\d+)/)
        if (match) { clearTimeout(timer); resolve(Number(match[1])) }
      })
    })
    const base = `http://127.0.0.1:${port}`
    const health = await fetch(`${base}/api/health`)
    assert.equal(health.status, 200)
    assert.equal((await health.json()).status, 'ok')
    assert.equal(health.headers.get('cache-control'), 'no-store')
    assert.equal(health.headers.get('access-control-allow-origin'), null)
    const write = await fetch(`${base}/api/stations`, { method: 'POST' })
    assert.equal(write.status, 405)
    assert.equal(write.headers.get('allow'), 'GET, HEAD')
    await write.text()
    const head = await fetch(`${base}/api/health`, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
    for (let index = 0; index < 1200; index++) {
      const response = await fetch(`${base}/api/not-found`)
      assert.equal(response.status, 404)
      await response.text()
    }
    const limited = await fetch(`${base}/api/not-found`)
    assert.equal(limited.status, 429)
    assert.equal(limited.headers.get('retry-after'), '60')
    await limited.text()
    assert.equal((await fetch(`${base}/api/health`)).status, 200)
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    }
  }
})
