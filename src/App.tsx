import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Command, GripVertical, LayoutGrid, ListFilter, Plus, Search, Settings2, Sparkles, Sun, X } from 'lucide-react'
import './App.css'

type ColumnId = 'inbox' | 'today' | 'doing' | 'done'
type Task = { id: string; title: string; column: ColumnId; tag: string; priority: 'high' | 'normal' | 'low'; due?: string; time?: string }
const columns: { id: ColumnId; label: string; tint: string }[] = [
  { id: 'inbox', label: 'To sort', tint: 'sage' },
  { id: 'today', label: 'Today', tint: 'peach' },
  { id: 'doing', label: 'In progress', tint: 'blue' },
  { id: 'done', label: 'Done', tint: 'lilac' },
]
const initialTasks: Task[] = [
  { id: 'a1', title: 'Book a table for Friday', column: 'inbox', tag: 'Life admin', priority: 'normal' },
  { id: 'a2', title: 'Send the photos to Maya', column: 'inbox', tag: 'People', priority: 'low' },
  { id: 'a3', title: 'Pick up the prescription', column: 'inbox', tag: 'Errands', priority: 'high', due: 'Today' },
  { id: 'b1', title: 'Review the new project brief', column: 'today', tag: 'Studio', priority: 'high', time: '25 min' },
  { id: 'b2', title: 'Take a proper lunch break', column: 'today', tag: 'Wellbeing', priority: 'normal' },
  { id: 'b3', title: 'Water the balcony plants', column: 'today', tag: 'Home', priority: 'low' },
  { id: 'c1', title: 'Plan the week ahead', column: 'doing', tag: 'Personal', priority: 'normal', time: '10 min' },
  { id: 'd1', title: 'Clear the kitchen counter', column: 'done', tag: 'Home', priority: 'low' },
]
const storageKey = 'daymark.tasks.v1'

function readTasks(): Task[] {
  try {
    const value = localStorage.getItem(storageKey)
    if (value) return JSON.parse(value) as Task[]
  } catch { /* Use the starter board when saved data is unavailable. */ }
  return initialTasks
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(readTasks)
  const [query, setQuery] = useState('')
  const [activeView, setActiveView] = useState<'board' | 'focus'>('board')
  const [draftColumn, setDraftColumn] = useState<ColumnId | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDone, setShowDone] = useState(true)

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(tasks)) }, [tasks])

  const visibleColumns = columns.filter((column) => showDone || column.id !== 'done')
  const visibleTasks = useMemo(() => tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase())), [tasks, query])
  const todayCount = tasks.filter((task) => task.column === 'today' || task.column === 'doing').length
  const completedCount = tasks.filter((task) => task.column === 'done').length

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draftTitle.trim()
    if (!title || !draftColumn) return
    setTasks((current) => [{ id: crypto.randomUUID(), title, column: draftColumn, tag: 'Personal', priority: 'normal' }, ...current])
    setDraftTitle('')
    setDraftColumn(null)
  }
  function moveTask(id: string, column: ColumnId) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, column } : task))
    setDragging(null)
  }
  function onDrop(event: DragEvent<HTMLElement>, column: ColumnId) {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || dragging
    if (id) moveTask(id, column)
  }
  function startAdd(column: ColumnId) { setDraftColumn(column); setDraftTitle('') }
  function nextUp() {
    const next = tasks.find((task) => task.column === 'today')
    if (next) moveTask(next.id, 'doing')
  }

  const [date] = useState(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Daymark home"><span className="brand-mark"><Sun size={17} strokeWidth={2.3} /></span><span>daymark</span></a>
        <div className="space-label">YOUR SPACE <button aria-label="Space settings"><Settings2 size={14} /></button></div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={activeView === 'board' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('board')}><LayoutGrid size={17} /> <span>My board</span><span className="nav-count">{todayCount}</span></button>
          <button className={activeView === 'focus' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('focus')}><Sparkles size={17} /> <span>Focus mode</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card"><div className="streak-icon"><Sun size={17} /></div><div><strong>One thing at a time.</strong><span>You’re making space for what matters.</span></div></div>
          <button className="profile"><span className="avatar">B</span><span className="profile-name"><strong>Brian’s space</strong><small>Personal board</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      <main id="top" className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>My space</span><span className="crumb-slash">/</span><strong>{activeView === 'focus' ? 'Focus mode' : 'My board'}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a task" aria-label="Find a task" /><kbd><Command size={10} /> K</kbd></label>
            <span className="topbar-divider" />
            <IconButton label="Help"><CircleHelp size={17} /></IconButton>
            <div className="create-wrap"><button className="create-button" onClick={() => setMenuOpen((open) => !open)}><Plus size={16} /> <span>New task</span><ChevronDown size={14} /></button>{menuOpen && <div className="create-menu"><button onClick={() => { startAdd('today'); setMenuOpen(false) }}>Add to Today</button><button onClick={() => { startAdd('inbox'); setMenuOpen(false) }}>Capture for later</button></div>}</div>
          </div>
        </header>

        {activeView === 'focus' ? (
          <section className="focus-view">
            <div className="focus-date"><Sun size={14} /> {date}</div>
            <h1>Make room for<br /><em>one good thing.</em></h1>
            <p className="focus-intro">A short list is a kind list. Pick one thing and give it your attention.</p>
            {tasks.filter((task) => task.column === 'today' || task.column === 'doing').slice(0, 1).map((task) => <article className="focus-task" key={task.id}><span className="focus-task-check" /><div><small>{task.tag} · {task.time || 'Whenever you’re ready'}</small><strong>{task.title}</strong></div><button onClick={() => moveTask(task.id, 'done')} aria-label="Mark complete"><Check size={18} /></button></article>)}
            <button className="focus-next" onClick={nextUp}>Bring the next task into focus <ArrowDown size={15} /></button>
            <button className="focus-return" onClick={() => setActiveView('board')}>Back to my board</button>
          </section>
        ) : <>
          <section className="page-heading">
            <div><div className="date-line"><Sun size={14} /> {date}</div><h1>Make today <em>yours.</em></h1><p>A little structure for all the things on your mind.</p></div>
            <div className="day-summary"><div className="summary-avatars"><span>B</span><i>✦</i></div><div><strong>{todayCount} things in motion</strong><small>{completedCount ? `${completedCount} done today — nice work` : 'Take it one thing at a time'}</small></div></div>
          </section>
          <div className="board-toolbar"><div className="board-tabs"><button className="tab-active"><LayoutGrid size={15} /> Board</button><button onClick={() => setActiveView('focus')}><Sparkles size={15} /> Focus</button></div><div className="board-tools"><span className="board-private"><span /> Just for you</span><button className="filter-button" onClick={() => setShowDone((value) => !value)}><ListFilter size={15} /> {showDone ? 'Hide done' : 'Show done'}</button></div></div>
          <section className="board" aria-label="Kanban board">
            {visibleColumns.map((column) => {
              const items = visibleTasks.filter((task) => task.column === column.id)
              return <section className={`board-column ${dragging ? 'is-dragging' : ''}`} key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, column.id)}>
                <div className="column-head"><span className={`column-dot ${column.tint}`} /><h2>{column.label}</h2><span className="column-count">{items.length}</span><IconButton label={`Add to ${column.label.toLowerCase()}`} onClick={() => startAdd(column.id)}><Plus size={16} /></IconButton></div>
                {draftColumn === column.id && <form className="task-draft" onSubmit={addTask}><input autoFocus value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="What’s on your mind?" aria-label="New task title" /><div><span>Press enter to add</span><button type="button" onClick={() => setDraftColumn(null)} aria-label="Cancel"><X size={15} /></button><button className="draft-submit" type="submit" aria-label="Save task"><Check size={15} /></button></div></form>}
                <div className="task-list">
                  {items.map((task) => <article className={`task-card ${task.column === 'done' ? 'is-done' : ''}`} key={task.id} draggable onDragStart={(event) => { setDragging(task.id); event.dataTransfer.setData('text/plain', task.id) }} onDragEnd={() => setDragging(null)}>
                    <button className="drag-handle" aria-label={`Drag ${task.title}`} tabIndex={-1}><GripVertical size={15} /></button>
                    <div className="task-main"><div className="task-tags"><span className={`tag tag-${task.tag.toLowerCase().replace(' ', '-')}`}>{task.tag}</span>{task.priority === 'high' && <span className="priority"><ArrowUp size={11} /> Important</span>}</div>
                      <button className="task-title" onClick={() => moveTask(task.id, task.column === 'done' ? 'today' : 'done')}>{task.title}</button>
                      {(task.due || task.time) && <div className="task-meta">{task.due && <span className="due-label"><CalendarDays size={12} /> {task.due}</span>}{task.time && <span><Clock3 size={12} /> {task.time}</span>}</div>}
                    </div>
                    <button className="task-menu" aria-label={`Delete ${task.title}`} onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}><X size={14} /></button>
                  </article>)}
                  {items.length === 0 && draftColumn !== column.id && <div className="empty-column">{column.id === 'done' ? 'A clean slate. Enjoy it.' : 'Nothing here yet.'}</div>}
                </div>
                {column.id !== 'done' && <button className="add-task" onClick={() => startAdd(column.id)}><Plus size={15} /> Add a task</button>}
              </section>
            })}
            {visibleColumns.length < 4 && <button className="show-done" onClick={() => setShowDone(true)}><Plus size={15} /> Show done column</button>}
          </section>
          <footer className="board-footer"><span><span className="local-indicator" /> Saved on this device</span><span>Drag tasks between columns · click a task to mark it done</span></footer>
        </>}
      </main>
    </div>
  )
}

export default App
