import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { ArrowUp, CalendarDays, Check, ChevronDown, Clock3, FolderKanban, GripVertical, LayoutGrid, ListFilter, Milestone, Plus, Search, Sun, Target, X } from 'lucide-react'
import { KanbanColumns } from './features/kanban/KanbanColumns'
import type { KanbanItemDragProps } from './features/kanban/useKanbanDrag'
import { groupTasksByProject } from './features/kanban/projectSwimlanes'
import { KanbanScrollFrame } from './features/kanban/KanbanScrollFrame'
import './App.css'

type ColumnId = 'inbox' | 'today' | 'doing' | 'done'
type Task = { id: string; title: string; column: ColumnId; tag: string; project: string; priority: 'high' | 'normal' | 'low'; due?: string; time?: string; createdAt?: string; milestone?: boolean }
type View = 'board' | 'projects' | 'roadmap' | 'focus'
const columns: { id: ColumnId; label: string; tint: string }[] = [
  { id: 'inbox', label: 'To sort', tint: 'sage' },
  { id: 'today', label: 'Today', tint: 'peach' },
  { id: 'doing', label: 'In progress', tint: 'blue' },
  { id: 'done', label: 'Done', tint: 'lilac' },
]
const viewLabels: Record<View, string> = { board: 'Today', projects: 'Projects', roadmap: 'Roadmap', focus: 'Focus' }
const storageKey = 'daymark.tasks.v1'
const projectStorageKey = 'daymark.projects.v1'
const importedCodexHistoryKey = 'daymark.local-projects.imported.v3'
const demoTaskIds = new Set(['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'd1', 'm1', 'm2'])
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function readTasks(): Task[] {
  try {
    const value = localStorage.getItem(storageKey)
    if (value) return (JSON.parse(value) as Partial<Task>[]).map((task) => ({
      ...task,
      id: task.id ?? crypto.randomUUID(),
      title: task.title ?? 'Untitled task',
      column: task.column ?? 'inbox',
      tag: task.tag ?? 'Personal',
      project: task.project ?? task.tag ?? 'Unsorted',
      priority: task.priority ?? 'normal',
      due: task.due === 'Today' ? new Date().toISOString().slice(0, 10) : task.due,
    })) as Task[]
  } catch { /* Use the starter board when saved data is unavailable. */ }
  return []
}

function readProjects(): string[] {
  try {
    const value = localStorage.getItem(projectStorageKey)
    return value ? JSON.parse(value) as string[] : []
  } catch { /* Start without projects when saved data is unavailable. */ }
  return []
}

function TaskCard({ task, onMove, onDelete, onDragStart, onDragEnd, dragProps, showProject = false, 'data-kanban-item-id': kanbanItemId }: {
  task: Task
  'data-kanban-item-id'?: string
  onMove: () => void
  onDelete: () => void
  onDragStart?: (event: DragEvent<HTMLElement>) => void
  onDragEnd?: () => void
  dragProps?: KanbanItemDragProps
  showProject?: boolean
}) {
  const { className: dragClassName, draggable, ...kanbanEvents } = dragProps ?? {}
  return <article data-kanban-item-id={kanbanItemId} className={`task-card ${task.column === 'done' ? 'is-done' : ''} ${task.milestone ? 'is-milestone' : ''} ${dragClassName ?? ''}`} draggable={draggable ?? true} {...kanbanEvents} onDragStart={onDragStart ?? dragProps?.onDragStart} onDragEnd={onDragEnd ?? dragProps?.onDragEnd}>
    <button className="drag-handle" aria-label={`Drag ${task.title}`} tabIndex={-1}><GripVertical size={15} /></button>
    <div className="task-main">
      <div className="task-tags">{task.milestone && <span className="milestone-label"><Milestone size={11} /> Milestone</span>}{showProject && <span className="project-label">{task.project}</span>}{!task.milestone && <span className={`tag tag-${task.tag.toLowerCase().replace(' ', '-')}`}>{task.tag}</span>}{task.priority === 'high' && <span className="priority"><ArrowUp size={11} /> Important</span>}</div>
      <button className="task-title" onClick={onMove}>{task.title}</button>
      {(task.due || task.createdAt || task.time) && <div className="task-meta">{(task.due || task.createdAt) && <span className="due-label"><CalendarDays size={12} /> {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${task.due ?? task.createdAt}T12:00:00`))}</span>}{task.time && <span><Clock3 size={12} /> {task.time}</span>}</div>}
    </div>
    <button className="task-menu" aria-label={`Delete ${task.title}`} onClick={onDelete}><X size={14} /></button>
  </article>
}

function TaskComposer({ projects, title, project, due, milestone, onTitle, onProject, onDue, onMilestone, onSubmit, onCancel }: {
  projects: string[]; title: string; project: string; due: string; milestone: boolean
  onTitle: (value: string) => void; onProject: (value: string) => void; onDue: (value: string) => void
  onMilestone: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void
}) {
  return <form className="task-draft" onSubmit={onSubmit}>
    <input autoFocus value={title} onChange={(event) => onTitle(event.target.value)} placeholder={milestone ? 'Name this milestone' : 'What’s on your mind?'} aria-label={milestone ? 'Milestone name' : 'New task title'} />
    <div className="task-draft-options"><select aria-label="Project" value={project} onChange={(event) => onProject(event.target.value)}>{projects.map((name) => <option key={name}>{name}</option>)}</select><label><CalendarDays size={12} /><input aria-label="Due date" type="date" value={due} onChange={(event) => onDue(event.target.value)} /></label><label className="milestone-toggle"><input type="checkbox" checked={milestone} onChange={(event) => onMilestone(event.target.checked)} /> Milestone</label></div>
    <div className="task-draft-actions"><span>{milestone && !due ? 'Choose a date for this milestone' : 'Press enter to add'}</span><button type="button" onClick={onCancel} aria-label="Cancel"><X size={15} /></button><button className="draft-submit" type="submit" aria-label="Save task" disabled={!title.trim() || (milestone && !due)}><Check size={15} /></button></div>
  </form>
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(readTasks)
  const [projects, setProjects] = useState<string[]>(readProjects)
  const [query, setQuery] = useState('')
  const [activeView, setActiveView] = useState<View>('board')
  const [draftColumn, setDraftColumn] = useState<ColumnId | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftProject, setDraftProject] = useState('Personal')
  const [draftDue, setDraftDue] = useState('')
  const [draftMilestone, setDraftMilestone] = useState(false)
  const [projectDraftOpen, setProjectDraftOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDone, setShowDone] = useState(true)

  useEffect(() => {
    if (localStorage.getItem(importedCodexHistoryKey) === 'done') return
    const loadLocalTasks = (path: string) => fetch(path).then((response) => response.ok ? response.json() as Promise<Task[]> : []).catch(() => [])
    const loadLocalProjects = () => fetch('/projects.json').then((response) => response.ok ? response.json() as Promise<string[]> : []).catch(() => [])
    Promise.all([loadLocalTasks('/codex-history.json'), loadLocalTasks('/project-updates.json'), loadLocalProjects()]).then(([history, updates, projectCatalog]) => {
      if (localStorage.getItem(importedCodexHistoryKey) === 'done') return
      const incoming = [...history, ...updates]
      if (!incoming.length && !projectCatalog.length) return
      const incomingIds = new Set(incoming.map((task) => task.id))
      const retained = tasks.filter((task) => !demoTaskIds.has(task.id) && !incomingIds.has(task.id))
      const existing = new Map(tasks.map((task) => [task.id, task]))
      const merged = incoming.map((task) => {
        const saved = existing.get(task.id)
        return saved ? { ...task, column: saved.column, due: saved.due, milestone: saved.milestone, priority: saved.priority } : task
      })
      setTasks([...merged, ...retained])
      setProjects([...new Set([...projectCatalog, ...merged.map((task) => task.project), ...retained.map((task) => task.project)])])
      localStorage.setItem(importedCodexHistoryKey, 'done')
    })
  }, [tasks])
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(tasks)) }, [tasks])
  useEffect(() => { localStorage.setItem(projectStorageKey, JSON.stringify(projects)) }, [projects])
  const startAdd = useCallback((column: ColumnId, milestone = false) => { setDraftColumn(column); setDraftTitle(''); setDraftProject(projects[0] ?? 'Personal'); setDraftDue(''); setDraftMilestone(milestone) }, [projects])

  const visibleColumns = columns.filter((column) => showDone || column.id !== 'done')
  const visibleTasks = useMemo(() => tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase())), [tasks, query])
  const boardItemsByState = useMemo(() => Object.fromEntries(columns.map((column) => [column.id, visibleTasks.filter((task) => task.column === column.id)])) as Record<ColumnId, Task[]>, [visibleTasks])
  const boardColumnDefinitions = useMemo(() => visibleColumns.map((column) => ({
    state: column.id,
    header: <><span className={`column-dot ${column.tint}`} /><h2>{column.label}</h2><button className="icon-button" aria-label={`Add to ${column.label.toLowerCase()}`} onClick={() => startAdd(column.id)}><Plus size={15} /></button></>,
    count: boardItemsByState[column.id].length,
  })), [boardItemsByState, startAdd, visibleColumns])
  const projectColumnDefinitions = useMemo(() => columns.map((column) => ({
    state: column.id,
    header: <><span className={`column-dot ${column.tint}`} /><h2>{column.label}</h2></>,
    count: boardItemsByState[column.id].length,
  })), [boardItemsByState])
  const projectLanes = useMemo(() => groupTasksByProject(visibleTasks, projects, columns.map((column) => column.id)), [visibleTasks, projects])
  const projectSwimlaneGroups = [{
    id: 'projects',
    label: 'Projects',
    lanes: projectLanes.map((project) => ({
      id: project.id,
      header: <span className="swimlane-project"><span className="project-symbol"><FolderKanban size={15} /></span><span><strong>{project.label}</strong><small>{project.itemCount} tasks</small></span></span>,
      itemsByState: project.itemsByState,
      footerByState: Object.fromEntries(columns.map((column) => [column.id,
        draftColumn === column.id && draftProject === project.id
          ? <TaskComposer key="draft" projects={projects} title={draftTitle} project={draftProject} due={draftDue} milestone={draftMilestone} onTitle={setDraftTitle} onProject={setDraftProject} onDue={setDraftDue} onMilestone={setDraftMilestone} onSubmit={addTask} onCancel={() => setDraftColumn(null)} />
          : <button key="add" className="lane-add" onClick={() => { startAdd(column.id); setDraftProject(project.id) }}><Plus size={14} /> Add</button>,
      ])) as Partial<Record<ColumnId, React.ReactNode>>,
    })),
  }]
  const todayCount = tasks.filter((task) => task.column === 'today' || task.column === 'doing').length

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draftTitle.trim()
    if (!title || !draftColumn || (draftMilestone && !draftDue)) return
    setTasks((current) => [{ id: crypto.randomUUID(), title, column: draftColumn, tag: draftProject, project: draftProject, priority: 'normal', due: draftDue || undefined, milestone: draftMilestone }, ...current])
    setDraftTitle('')
    setDraftDue('')
    setDraftMilestone(false)
    setDraftColumn(null)
  }
  function moveTask(id: string, column: ColumnId, project?: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, column, project: project ?? task.project } : task))
    setDragging(null)
  }
  function onRoadmapDrop(event: DragEvent<HTMLElement>, project: string, monthKey: string) {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || dragging
    if (!id) return
    const [year, month] = monthKey.split('-').map(Number)
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task
      const day = String(Math.min(28, Number(task.due?.slice(-2) ?? 15))).padStart(2, '0')
      return { ...task, project, due: `${year}-${String(month).padStart(2, '0')}-${day}` }
    }))
    setDragging(null)
  }
  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = projectName.trim()
    if (!name || projects.some((project) => project.toLowerCase() === name.toLowerCase())) return
    setProjects((current) => [...current, name])
    setProjectName('')
    setProjectDraftOpen(false)
  }
  const focusTask = tasks.find((task) => task.column === 'doing') ?? tasks.find((task) => task.column === 'today')
  const [roadmapStart] = useState(() => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() } })
  const roadmapMonths = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const absoluteMonth = roadmapStart.month + index
    const year = roadmapStart.year + Math.floor(absoluteMonth / 12)
    const month = absoluteMonth % 12
    return { key: `${year}-${String(month + 1).padStart(2, '0')}`, label: monthNames[month], year }
  }), [roadmapStart])
  const roadmapUnplaced = visibleTasks.filter((task) => !task.due || !roadmapMonths.some((month) => task.due?.startsWith(month.key)))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Daymark home"><span className="brand-mark"><Sun size={17} strokeWidth={2.3} /></span><span>daymark</span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={activeView === 'board' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('board')}><LayoutGrid size={17} /> <span>Today</span><span className="nav-count">{todayCount}</span></button>
          <button className={activeView === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('projects')}><FolderKanban size={17} /> <span>Projects</span></button>
          <button className={activeView === 'roadmap' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('roadmap')}><Milestone size={17} /> <span>Roadmap</span></button>
          <button className={activeView === 'focus' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('focus')}><Target size={17} /> <span>Focus</span></button>
        </nav>
      </aside>

      <main id="top" className="main-content">
        <header className="topbar">
          <h1 className="topbar-title">{viewLabels[activeView]}</h1>
          <div className="topbar-actions">
            {activeView !== 'focus' && <>
            <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a task" aria-label="Find a task" /></label>
            <div className="create-wrap"><button className="create-button" aria-label={activeView === 'roadmap' ? 'Create milestone' : 'Create task'} onClick={() => setMenuOpen((open) => !open)}><Plus size={16} /> <span>{activeView === 'roadmap' ? 'New milestone' : 'New task'}</span><ChevronDown size={14} /></button>{menuOpen && <div className="create-menu">{activeView === 'roadmap' && <button onClick={() => { startAdd('inbox', true); setMenuOpen(false) }}>Add milestone</button>}<button onClick={() => { startAdd('today'); setMenuOpen(false) }}>Add to Today</button><button onClick={() => { startAdd('inbox'); setMenuOpen(false) }}>Capture for later</button>{activeView === 'projects' && <button onClick={() => { setProjectDraftOpen(true); setMenuOpen(false) }}>New project</button>}</div>}</div>
            </>}
          </div>
        </header>

        {activeView === 'focus' ? (
          <section className="focus-view" aria-label="Focus task">
            {focusTask ? <article className="focus-task"><div><small>{focusTask.project} · {focusTask.column === 'today' ? 'Today' : 'In progress'}</small><strong>{focusTask.title}</strong></div><button onClick={() => moveTask(focusTask.id, 'done')} aria-label="Mark complete"><Check size={18} /></button></article> : <p className="focus-empty">Nothing in progress. Choose a task from Today.</p>}
            <button className="focus-return" onClick={() => setActiveView('board')}>Back to Today</button>
          </section>
        ) : <>
          {activeView === 'board' && <div className="board-toolbar"><button className="filter-button" onClick={() => setShowDone((value) => !value)}><ListFilter size={15} /> {showDone ? 'Hide done' : 'Show done'}</button></div>}
          {projectDraftOpen && <form className="project-create" onSubmit={addProject}><FolderKanban size={16} /><input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Name your project" aria-label="Project name" /><button type="button" onClick={() => setProjectDraftOpen(false)} aria-label="Cancel"><X size={15} /></button><button className="draft-submit" type="submit" disabled={!projectName.trim()}><Check size={15} /> Add project</button></form>}
          {activeView === 'board' && <>
            {draftColumn && <div className="board-composer"><TaskComposer projects={projects} title={draftTitle} project={draftProject} due={draftDue} milestone={draftMilestone} onTitle={setDraftTitle} onProject={setDraftProject} onDue={setDraftDue} onMilestone={setDraftMilestone} onSubmit={addTask} onCancel={() => setDraftColumn(null)} /></div>}
            <KanbanScrollFrame><KanbanColumns
              boardClassName="board"
              columnBodyClassName="task-list"
              columnClassName="board-column"
              columnEmptyClassName="empty-column"
              columnHeaderClassName="column-head"
              columnCountClassName="column-count"
              columns={boardColumnDefinitions}
              emptyLabel="Nothing here yet."
              getItemId={(task) => task.id}
              getItemDragLabel={(task) => task.title}
              itemsByState={boardItemsByState}
              onItemDrop={(task, target) => moveTask(task.id, target)}
              renderItem={(task, _state, dragProps) => <TaskCard data-kanban-item-id={task.id} task={task} dragProps={dragProps} onMove={() => moveTask(task.id, task.column === 'done' ? 'today' : 'done')} onDelete={() => setTasks((current) => current.filter((item) => item.id !== task.id))} />}
            /></KanbanScrollFrame>
            <footer className="board-footer"><span><span className="local-indicator" /> Saved on this device</span></footer>
          </>}
          {activeView === 'projects' && <KanbanScrollFrame><KanbanColumns
            boardClassName="swimlanes-board"
            columnBodyClassName="task-list"
            columnClassName="board-column"
            columnEmptyClassName="empty-column"
            columnHeaderClassName="column-head"
            columnCountClassName="column-count"
            columns={projectColumnDefinitions}
            emptyLabel="No tasks in this project."
            getItemId={(task) => task.id}
            getItemLaneId={(task) => task.project}
            getItemDragLabel={(task) => task.title}
            itemsByState={boardItemsByState}
            onItemDrop={(task, target, _source, targetProject) => moveTask(task.id, target, targetProject)}
            renderItem={(task, _state, dragProps) => <TaskCard data-kanban-item-id={task.id} task={task} dragProps={dragProps} onMove={() => moveTask(task.id, task.column === 'done' ? 'today' : 'done')} onDelete={() => setTasks((current) => current.filter((item) => item.id !== task.id))} />}
            swimlaneGroups={projectSwimlaneGroups}
          /></KanbanScrollFrame>}
          {activeView === 'roadmap' && <section className="roadmap" aria-label="Project roadmap">
            <div className="roadmap-grid roadmap-header"><span>PROJECT</span>{roadmapMonths.map((month) => <span key={month.key}>{month.label}<small>{month.year}</small></span>)}</div>
            {projectLanes.map((project) => <div className="roadmap-grid roadmap-row" key={project.id}>
              <header className="roadmap-project"><strong>{project.label}</strong><small>{project.itemsByState[columns[0].id].filter((task) => task.due).length + project.itemsByState[columns[1].id].filter((task) => task.due).length + project.itemsByState[columns[2].id].filter((task) => task.due).length + project.itemsByState[columns[3].id].filter((task) => task.due).length} dated items</small></header>
              {roadmapMonths.map((month) => {
                const items = columns.flatMap((column) => project.itemsByState[column.id]).filter((task) => task.due?.startsWith(month.key))
                return <section className="roadmap-cell" key={month.key} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onRoadmapDrop(event, project.id, month.key)}>{items.map((task) => <TaskCard key={task.id} task={task} showProject={false} onMove={() => moveTask(task.id, task.column === 'done' ? 'today' : 'done')} onDelete={() => setTasks((current) => current.filter((item) => item.id !== task.id))} onDragStart={(event) => { setDragging(task.id); event.dataTransfer.setData('text/plain', task.id) }} onDragEnd={() => setDragging(null)} />)}</section>
              })}
            </div>)}
            {roadmapUnplaced.length > 0 && <section className="roadmap-undated"><header><strong>Unscheduled &amp; later</strong><small>{roadmapUnplaced.length} items outside this six-month view</small></header><div>{roadmapUnplaced.map((task) => <TaskCard key={task.id} task={task} showProject onMove={() => moveTask(task.id, task.column === 'done' ? 'today' : 'done')} onDelete={() => setTasks((current) => current.filter((item) => item.id !== task.id))} onDragStart={(event) => { setDragging(task.id); event.dataTransfer.setData('text/plain', task.id) }} onDragEnd={() => setDragging(null)} />)}</div></section>}
            <p className="roadmap-hint"><Milestone size={14} /> Drag any card to a month to give it a date. Create dated milestones from the top-right menu.</p>
          </section>}
          {draftColumn !== null && activeView !== 'board' && activeView !== 'projects' && <div className="roadmap-create"><TaskComposer projects={projects} title={draftTitle} project={draftProject} due={draftDue} milestone={draftMilestone} onTitle={setDraftTitle} onProject={setDraftProject} onDue={setDraftDue} onMilestone={setDraftMilestone} onSubmit={addTask} onCancel={() => setDraftColumn(null)} /></div>}
        </>}
      </main>
    </div>
  )
}

export default App
