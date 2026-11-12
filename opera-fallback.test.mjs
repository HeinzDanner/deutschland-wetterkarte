import test from 'node:test'
import assert from 'node:assert/strict'

const primary = 's3.waw3-1.cloudferro.com'
const backup = 'object-store.os-api.cci1.ecmwf.int'
const time = new Date(Math.floor(Date.now() / 900000) * 900000)
const stamp = time.toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 13)
const day = time.toISOString().slice(0, 10).replaceAll('-', '/')
const key = `${day}/OPERA/COMP/OPERA@${stamp}@0@RATE.tiff`
const listing = (keys) => `<?xml version="1.0"?><ListBucketResult>${keys.map((item) => `<Contents><Key>${item}</Key></Contents>`).join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`
const latest = time.toISOString().replace(/\.\d{3}Z$/, '.000Z')

async function scenario(callback) {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  const originalWarn = console.warn
  const calls = []
  let fetchHandler
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return fetchHandler(new URL(url))
  }
  console.warn = () => {}
  try {
    const module = await import(`./opera.mjs?test=${Math.random()}`)
    await callback({ ...module, calls, setFetch: (handler) => { fetchHandler = handler }, originalNow })
  } finally {
    globalThis.fetch = originalFetch
    Date.now = originalNow
    console.warn = originalWarn
  }
}

test('prefers primary, coalesces concurrent requests, and does not query backup', async () => {
  await scenario(async ({ getOperaFrames, calls, setFetch }) => {
    setFetch((url) => new Response(listing(url.searchParams.get('prefix')?.startsWith(day) ? [key] : [])))
    const [one, two] = await Promise.all([getOperaFrames(), getOperaFrames()])
    assert.deepEqual(one.frames, [latest])
    assert.deepEqual(one, two)
    assert.equal(calls.filter((url) => new URL(url).hostname === primary).length, time.getUTCHours() < 4 ? 2 : 1)
    assert.equal(calls.some((url) => new URL(url).hostname === backup), false)
  })
})

test('empty or unreachable primary falls back to backup and returns to recovered primary after cache expiry', async () => {
  for (const mode of ['empty', 'failure']) {
    await scenario(async ({ getOperaFrames, getOperaFrame, calls, setFetch, originalNow }) => {
      let recovered = false
      setFetch((url) => {
        if (!url.searchParams.has('list-type')) return new Response('missing', { status: 404 })
        if (url.hostname === primary && !recovered && mode === 'failure') throw new Error('network down')
        return new Response(listing(url.searchParams.get('prefix')?.startsWith(day) &&
          (url.hostname === backup || recovered) ? [key] : []))
      })
      assert.equal((await getOperaFrames()).latest, latest)
      assert.ok(calls.some((url) => new URL(url).hostname === backup))
      await assert.rejects(getOperaFrame(latest))
      const downloads = calls.filter((url) => !new URL(url).searchParams.has('list-type'))
      assert.equal(new URL(downloads[0]).hostname, backup)
      assert.equal(new URL(downloads[1]).hostname, primary)
      calls.length = 0
      recovered = true
      Date.now = () => originalNow() + 61000
      assert.equal((await getOperaFrames()).latest, latest)
      assert.ok(calls.some((url) => new URL(url).hostname === primary))
      assert.equal(calls.some((url) => new URL(url).hostname === backup), false)
      await assert.rejects(getOperaFrame(latest))
      assert.equal(new URL(calls.find((url) => !new URL(url).searchParams.has('list-type'))).hostname, primary)
    })
  }
})

test('never returns stale or future timestamps and surfaces failures of both sources', async () => {
  await scenario(async ({ getOperaFrames, setFetch }) => {
    const old = new Date(time.getTime() - 6 * 3600000)
    const future = new Date(time.getTime() + 24 * 3600000)
    const toKey = (date) => `${day}/OPERA/COMP/OPERA@${date.toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 13)}@0@RATE.tiff`
    setFetch(() => new Response(listing([toKey(old), toKey(future)])))
    await assert.rejects(getOperaFrames(), /Keine aktuellen OPERA-Niederschlagsbilder verfügbar/)
    setFetch((url) => url.hostname === primary
      ? new Response('unavailable', { status: 503 }) : new Response(listing([])))
    await assert.rejects(getOperaFrames(), /OPERA-Hauptquelle und Backup sind nicht verfügbar/)
  })
})
