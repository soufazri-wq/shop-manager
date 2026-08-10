const API = '/api'
const TIMEOUT = 10000

function getToken() {
  return localStorage.getItem('token') || ''
}

export function setToken(token) {
  if (token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = 'Bearer ' + token

  const options = { method, headers }
  if (body !== undefined) options.body = JSON.stringify(body)

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const e = new Error('No internet connection')
    e.offline = true
    throw e
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  options.signal = controller.signal

  let res
  try {
    res = await fetch(API + path, options)
  } catch (err) {
    const e = new Error(err && err.name === 'AbortError' ? 'Request timed out' : 'Network error')
    e.offline = true
    e.cause = err
    throw e
  } finally {
    clearTimeout(timer)
  }

  let data = null
  try {
    data = await res.json()
  } catch (e) {
    data = null
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
}
