import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function KanbanProjectGroup({ label, accentColor, children }: { label: string; accentColor?: string; children: ReactNode }) {
  const [isCompact, setIsCompact] = useState(false);
  const lanesId = useId();
  const Chevron = isCompact ? ChevronRight : ChevronDown;

  return (
    <section aria-label={label} className={`kanban-project-group${isCompact ? " is-compact" : ""}`}>
      <h3 className="kanban-project-label" style={accentColor ? { "--kanban-project-accent": accentColor } as CSSProperties : undefined}>
        <button
          aria-controls={lanesId}
          aria-label={`${isCompact ? "Expand" : "Compact"} ${label} swimlanes`}
          aria-pressed={isCompact}
          className="kanban-project-toggle"
          onClick={() => setIsCompact((current) => !current)}
          type="button"
        >
          <span><Chevron aria-hidden="true" size={14} />{label}</span>
        </button>
      </h3>
      <div className="kanban-project-lanes" id={lanesId}>{children}</div>
    </section>
  );
}
