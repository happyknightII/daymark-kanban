export interface ProjectSwimlane<TItem, TState extends string> {
  id: string
  label: string
  itemsByState: Record<TState, TItem[]>
  itemCount: number
}

export function groupTasksByProject<
  TItem extends { project: string; column: TState },
  TState extends string,
>(items: readonly TItem[], projects: readonly string[], states: readonly TState[]): ProjectSwimlane<TItem, TState>[] {
  const itemsByProject = new Map<string, TItem[]>()
  for (const item of items) {
    const project = item.project || 'Unassigned'
    const group = itemsByProject.get(project)
    if (group) group.push(item)
    else itemsByProject.set(project, [item])
  }

  const projectOrder = [...new Set([...projects, ...itemsByProject.keys()])]
  return projectOrder.map((project) => {
    const projectItems = itemsByProject.get(project) ?? []
    const itemsByState = Object.fromEntries(states.map((state) => [
      state,
      projectItems.filter((item) => item.column === state),
    ])) as Record<TState, TItem[]>
    return { id: project, label: project, itemsByState, itemCount: projectItems.length }
  })
}
