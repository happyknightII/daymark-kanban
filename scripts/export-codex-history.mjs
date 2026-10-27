import { open, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const codexHome = process.env.CODEX_HOME || join(process.env.HOME, '.codex')
const roots = [join(codexHome, 'sessions'), join(codexHome, 'archived_sessions')]
const output = join(process.cwd(), 'public', 'codex-history.json')
const maxSessions = 60
const maxReadBytes = 1024 * 1024

async function filesIn(directory) {
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch { return [] }
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return filesIn(path)
    return entry.isFile() && entry.name.endsWith('.jsonl') ? [path] : []
  }))
  return nested.flat()
}

function promptText(record) {
  const payload = record.payload
  if (record.type !== 'response_item' || payload?.type !== 'message' || payload.role !== 'user') return ''
  return (payload.content ?? []).map((part) => part?.text ?? '').join(' ').replace(/\s+/g, ' ').trim()
}

function usablePrompt(text) {
  return text.length > 8 && !text.startsWith('/') && !text.startsWith('<') &&
    !text.startsWith('{') && !text.startsWith('# Files mentioned') &&
    !text.startsWith('# AGENTS.md') && !text.includes('<environment_context>') &&
    !text.includes('<INSTRUCTIONS>') && !text.includes('<send_user_message_question_reply>')
}

function projectName(metadata, title) {
  const root = metadata.runtime_workspace_roots?.[0] || metadata.cwd || ''
  const path = root.toLowerCase()
  const prompt = title.toLowerCase()
  if (path.includes('mission-control') || prompt.includes('mission control')) return 'Mission Control'
  if (path.includes('autodrive') || prompt.includes('autodrive')) return 'AutoDrive'
  if (path.includes('autoscout') || prompt.includes('autoscout')) return 'AutoScout'
  if (path.includes('daymark-kanban')) return 'Daymark'
  if (path.includes('/codex')) {
    if (/rustdesk|ssh perms|vm |virtual machine|drive:|ssd|openhands/.test(prompt)) return 'Host setup'
    return 'Codex work'
  }
  const name = basename(root) || 'Host system'
  if (name.toLowerCase() === 'brian') return 'Host system'
  return name.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const candidates = (await Promise.all(roots.map(filesIn))).flat()
const recent = await Promise.all(candidates.map(async (path) => ({ path, modified: (await stat(path)).mtimeMs })))
recent.sort((a, b) => b.modified - a.modified)

const seen = new Set()
const tasks = []
for (const { path } of recent) {
  if (tasks.length >= maxSessions) break
  let metadata
  let title = ''
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(maxReadBytes)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    for (const line of buffer.toString('utf8', 0, bytesRead).split('\n')) {
      if (!line) continue
      let record
      try { record = JSON.parse(line) } catch { continue }
      if (record.type === 'session_meta') metadata = record.payload
      if (!title) {
        const text = promptText(record)
        if (usablePrompt(text)) title = text.split(/\n/)[0].trim()
      }
      if (metadata && title) break
    }
  } finally { await handle.close() }
  if (!metadata?.session_id || seen.has(metadata.session_id) || !title) continue
  seen.add(metadata.session_id)
  const createdAt = (metadata.timestamp || '').slice(0, 10)
  if (!createdAt) continue
  tasks.push({
    id: `codex-${metadata.session_id}`,
    title: title.slice(0, 140),
    column: 'done',
    tag: 'Codex',
    project: projectName(metadata, title),
    priority: 'normal',
    createdAt,
  })
}

await writeFile(output, `${JSON.stringify(tasks, null, 2)}\n`)
console.log(`Exported ${tasks.length} Codex session summaries to ${output}`)
