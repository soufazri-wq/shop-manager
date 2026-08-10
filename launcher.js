const { spawn, exec } = require('child_process')
const path = require('path')
const fs = require('fs')

const projectDir = __dirname
const serverDir = path.join(projectDir, 'server')
const PORT = 4000
const BASE = 'http://localhost:' + PORT

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function httpCheck(url, timeout = 1200) {
  return new Promise((resolve) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    fetch(url, { signal: controller.signal })
      .then((res) => resolve(res.status < 500))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(timer))
  })
}

function killPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano -p tcp | findstr :${port}`, (err, stdout) => {
      if (err) return resolve()
      const pids = new Set()
      for (const line of stdout.split('\n')) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 5 && parts[3] === 'LISTENING') pids.add(parts[4])
      }
      let done = 0
      if (!pids.size) return resolve()
      for (const pid of pids) {
        exec(`taskkill /PID ${pid} /F`, () => {
          done++
          if (done >= pids.size) resolve()
        })
      }
    })
  })
}

async function serverServesApp() {
  try {
    const res = await fetch(BASE + '/', { signal: AbortSignal.timeout(2000) })
    if (res.status !== 200) return false
    const html = await res.text()
    return html.includes('id="root"')
  } catch {
    return false
  }
}

async function ensureServer() {
  const healthy = await httpCheck(BASE + '/api/health')
  if (healthy && (await serverServesApp())) return true

  await killPort(PORT)
  await sleep(800)

  const child = spawn(process.execPath, ['index.js'], {
    cwd: serverDir,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  })
  child.unref()

  for (let i = 0; i < 30; i++) {
    await sleep(500)
    if (await httpCheck(BASE + '/api/health')) return true
  }
  return false
}

async function main() {
  await ensureServer()
  exec(`start "" "${BASE}"`)
  setTimeout(() => process.exit(0), 1500)
}

main()
