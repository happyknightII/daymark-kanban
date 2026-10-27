import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = dirname(fileURLToPath(import.meta.url))
const publicDir = join(root, 'dist')
const dataFile = resolve(process.env.DAYMARK_DATA_FILE ?? join(homedir(), 'Projects/daymark-data/state.json'))
const host = process.env.DAYMARK_HOST ?? '127.0.0.1'
const port = Number(process.env.DAYMARK_PORT ?? 5176)
const states = new Set(['inbox', 'today', 'doing', 'done'])
const priorities = new Set(['high', 'normal', 'low'])
const maxBodyBytes = 1_000_000
const mimeTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' }

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch { return fallback }
}

async function loadState() {
  try {
    const saved = JSON.parse(await readFile(dataFile, 'utf8'))
    if (!Array.isArray(saved.tasks) || !Array.isArray(saved.projects) || !Number.isInteger(saved.revision)) throw new Error(`Invalid Daymark state file: ${dataFile}`)
    return saved
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return seedState()
  }
}

async function seedState() {
  const [history, updates, projectCatalog] = await Promise.all([
    readJson(join(root, 'public/codex-history.json'), []),
    readJson(join(root, 'public/project-updates.json'), []),
    readJson(join(root, 'public/projects.json'), []),
  ])
  const tasks = [...new Map([...history, ...updates].map((task) => [task.id, task])).values()]
  const projects = [...new Set([...projectCatalog, ...tasks.map((task) => task.project)].filter(Boolean))]
  return { revision: 1, updatedAt: new Date().toISOString(), tasks, projects }
}

let state = await loadState()
let saveQueue = Promise.resolve()

function saveState() {
  const contents = JSON.stringify(state, null, 2)
  const temporaryFile = `${dataFile}.${process.pid}.tmp`
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await mkdir(dirname(dataFile), { recursive: true })
    await writeFile(temporaryFile, contents, { mode: 0o600 })
    await rename(temporaryFile, dataFile)
  })
  return saveQueue
}

await saveState()

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

async function readBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > maxBodyBytes) throw Object.assign(new Error('Request body is too large.'), { status: 413 })
  }
  try { return JSON.parse(body || '{}') } catch { throw Object.assign(new Error('Body must be valid JSON.'), { status: 400 }) }
}

function normalizeTask(task) {
  if (task.title !== undefined && (typeof task.title !== 'string' || !task.title.trim())) throw Object.assign(new Error('Task title must not be empty.'), { status: 400 })
  if (task.column !== undefined && !states.has(task.column)) throw Object.assign(new Error('column must be inbox, today, doing, or done.'), { status: 400 })
  if (task.priority !== undefined && !priorities.has(task.priority)) throw Object.assign(new Error('priority must be high, normal, or low.'), { status: 400 })
  if (task.project !== undefined && (typeof task.project !== 'string' || !task.project.trim())) throw Object.assign(new Error('project must be a non-empty string.'), { status: 400 })
  const allowed = ['title', 'column', 'tag', 'project', 'priority', 'due', 'time', 'createdAt', 'milestone']
  return Object.fromEntries(allowed.filter((key) => task[key] !== undefined).map((key) => [key, task[key]]))
}

async function handleApi(request, response, url) {
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (path === '/api/v1' && request.method === 'GET') {
    return sendJson(response, 200, {
      name: 'Daymark API',
      version: '1',
      access: 'Tailnet only',
      endpoints: {
        state: 'GET or PUT /api/v1/state',
        projects: 'GET or POST /api/v1/projects',
        tasks: 'GET or POST /api/v1/tasks',
        task: 'PATCH or DELETE /api/v1/tasks/{id}',
      },
      taskColumns: [...states],
    })
  }
  if (path === '/api/v1/state' && request.method === 'GET') return sendJson(response, 200, state)
  if (path === '/api/v1/state' && request.method === 'PUT') {
    const body = await readBody(request)
    if (!Array.isArray(body.tasks) || !Array.isArray(body.projects) || body.projects.some((project) => typeof project !== 'string')) {
      return sendJson(response, 400, { error: 'Provide tasks and projects arrays.' })
    }
    for (const task of body.tasks) {
      if (!task || typeof task.id !== 'string' || !task.id || typeof task.title !== 'string' || !task.title.trim() || typeof task.project !== 'string' || !task.project.trim()) {
        return sendJson(response, 400, { error: 'Each task needs a non-empty id, title, and project.' })
      }
      normalizeTask(task)
    }
    const projects = [...new Set([...body.projects, ...body.tasks.map((task) => task.project)].map((project) => project.trim()).filter(Boolean))]
    state = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString(), tasks: body.tasks, projects }
    await saveState()
    return sendJson(response, 200, state)
  }
  if (path === '/api/v1/projects' && request.method === 'GET') return sendJson(response, 200, { projects: state.projects })
  if (path === '/api/v1/projects' && request.method === 'POST') {
    const body = await readBody(request)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return sendJson(response, 400, { error: 'Project name is required.' })
    if (!state.projects.some((project) => project.toLowerCase() === name.toLowerCase())) {
      state = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString(), projects: [...state.projects, name] }
      await saveState()
    }
    return sendJson(response, 201, { projects: state.projects })
  }
  if (path === '/api/v1/tasks' && request.method === 'GET') return sendJson(response, 200, { tasks: state.tasks })
  if (path === '/api/v1/tasks' && request.method === 'POST') {
    const body = await readBody(request)
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return sendJson(response, 400, { error: 'Task title is required.' })
    const project = typeof body.project === 'string' && body.project.trim() ? body.project.trim() : state.projects[0] ?? 'Personal'
    const fields = normalizeTask({ ...body, title, project })
    const task = { id: randomUUID(), column: 'inbox', tag: project, priority: 'normal', createdAt: new Date().toISOString().slice(0, 10), ...fields }
    state = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString(), projects: state.projects.includes(project) ? state.projects : [...state.projects, project], tasks: [task, ...state.tasks] }
    await saveState()
    return sendJson(response, 201, { task, revision: state.revision })
  }
  const taskRoute = path.match(/^\/api\/v1\/tasks\/([^/]+)$/)
  if (taskRoute) {
    const id = decodeURIComponent(taskRoute[1])
    const index = state.tasks.findIndex((task) => task.id === id)
    if (index < 0) return sendJson(response, 404, { error: 'Task not found.' })
    if (request.method === 'PATCH') {
      const body = await readBody(request)
      const patch = normalizeTask(body)
      const tasks = [...state.tasks]
      tasks[index] = { ...tasks[index], ...patch }
      const project = tasks[index].project
      state = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString(), tasks, projects: project && !state.projects.includes(project) ? [...state.projects, project] : state.projects }
      await saveState()
      return sendJson(response, 200, { task: tasks[index], revision: state.revision })
    }
    if (request.method === 'DELETE') {
      state = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString(), tasks: state.tasks.filter((task) => task.id !== id) }
      await saveState()
      return sendJson(response, 200, { deleted: id, revision: state.revision })
    }
  }
  return sendJson(response, 404, { error: 'Endpoint not found.' })
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url)
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Method not allowed.' })
    const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const file = resolve(publicDir, `.${requestedPath}`)
    if (file !== publicDir && !file.startsWith(`${publicDir}${sep}`)) return sendJson(response, 403, { error: 'Forbidden.' })
    let contents
    try { contents = await readFile(file) } catch { contents = await readFile(join(publicDir, 'index.html')) }
    response.writeHead(200, { 'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' })
    response.end(request.method === 'HEAD' ? undefined : contents)
  } catch (error) {
    sendJson(response, error.status ?? 500, { error: error.message ?? 'Internal server error.' })
  }
})

server.listen(port, host, () => console.log(`Daymark listening on http://${host}:${port}; data: ${dataFile}`))
