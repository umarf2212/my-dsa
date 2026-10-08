"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import SyntaxHighlightedCode from "./components/SyntaxHighlightedCode";

type Status = "not_started" | "in_progress" | "completed" | "needs_review";

type ParagraphBlock = {
  id: string;
  type: "paragraph";
  text: string;
};

type ListBlock = {
  id: string;
  type: "list";
  ordered: boolean;
  items: { text: string }[];
};

type CodeBlock = {
  id: string;
  type: "code";
  language: string;
  code: string;
};

type ContentBlock = ParagraphBlock | ListBlock | CodeBlock;

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

type RoadmapNode = {
  id: string;
  type: "problem";
  slug: string;
  order: number;
  graphOrder: number;
  sectionId: string;
  sectionOrder: number;
  label: string;
  title: string;
  content: ContentBlock[];
  study: {
    status: Status;
    completed: boolean;
    attempts: number;
    notes: string;
    lastReviewedAt: string | null;
    reviewDates: string[];
    checklist: ChecklistItem[];
  };
};

type Section = {
  id: string;
  type: "section";
  order: number;
  title: string;
  sourceLabel: string;
  focus: string;
  exitCheck: string;
  note?: string;
  problemNodeIds: string[];
  problemCount: number;
};

type TopicNode = {
  id: string;
  type: "topic";
  order: number;
  title: string;
  label: string;
  sectionId: string;
  problemNodeIds: string[];
  problemCount: number;
};

type Milestone = {
  id: string;
  name: string;
  phases: string;
  outcome: string;
};

type RoadmapData = {
  schemaVersion: string;
  id: string;
  type: "roadmap";
  title: string;
  description: string;
  source: {
    url: string;
    creator: string;
    capturedAt: string;
  };
  stats: {
    sectionCount: number;
    topicNodeCount: number;
    problemNodeCount: number;
    contentBlockCount: number;
    codeBlockCount: number;
  };
  milestones: Milestone[];
  topicNodes: TopicNode[];
  sections: Section[];
  nodes: RoadmapNode[];
};

type NodeProgress = {
  status: Status;
  completed: boolean;
  attempts: number;
  notes: string;
  checklist: Record<string, boolean>;
};

type ProgressMap = Record<string, NodeProgress>;
type StatusFilter = "all" | Status;

const STATUS_LABELS: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  needs_review: "Review",
};

const STATUS_SHORT: Record<Status, string> = {
  not_started: "New",
  in_progress: "Active",
  completed: "Done",
  needs_review: "Review",
};

function defaultProgress(node: RoadmapNode): NodeProgress {
  return {
    status: node.study.status,
    completed: node.study.completed,
    attempts: node.study.attempts,
    notes: node.study.notes,
    checklist: Object.fromEntries(
      node.study.checklist.map((item) => [item.id, item.completed]),
    ),
  };
}

function readSavedProgress(nodes: RoadmapNode[]): ProgressMap {
  const initial = Object.fromEntries(
    nodes.map((node) => [node.id, defaultProgress(node)]),
  );
  if (typeof window === "undefined") return initial;

  try {
    const saved = window.localStorage.getItem("dsa-roadmap-progress-v1");
    if (!saved) return initial;
    const parsed = JSON.parse(saved) as ProgressMap;
    return Object.fromEntries(
      nodes.map((node) => [node.id, { ...initial[node.id], ...parsed[node.id] }]),
    );
  } catch {
    return initial;
  }
}

function getExcerpt(node: RoadmapNode) {
  const paragraph = node.content.find((block) => block.type === "paragraph");
  if (!paragraph || paragraph.type !== "paragraph") return "Open the node to see the full problem statement.";
  return paragraph.text.length > 164
    ? `${paragraph.text.slice(0, 164).trimEnd()}…`
    : paragraph.text;
}

function getCodeCount(node: RoadmapNode) {
  return node.content.filter((block) => block.type === "code").length;
}

function renderContent(block: ContentBlock) {
  if (block.type === "paragraph") {
    return <p key={block.id}>{block.text}</p>;
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag key={block.id}>
        {block.items.map((item, index) => (
          <li key={`${block.id}-${index}`}>{item.text}</li>
        ))}
      </ListTag>
    );
  }

  return (
    <div className="code-block" key={block.id}>
      <div className="code-label">
        <span>Source snippet</span>
        <span>{block.language}</span>
      </div>
      <SyntaxHighlightedCode code={block.code} language={block.language} />
    </div>
  );
}

function formatCapturedDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function ProgressRing({ value, size = "large" }: { value: number; size?: "small" | "large" }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`progress-ring progress-ring-${size}`}
      style={{ "--progress": `${safeValue * 3.6}deg` } as CSSProperties}
      aria-label={`${Math.round(safeValue)} percent complete`}
    >
      <div className="progress-ring-inner">
        <strong>{Math.round(safeValue)}%</strong>
        <span>complete</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/roadmap.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the roadmap data.");
        return response.json() as Promise<RoadmapData>;
      })
      .then((roadmap) => {
        if (cancelled) return;
        setData(roadmap);
        setProgress(readSavedProgress(roadmap.nodes));
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    window.localStorage.setItem("dsa-roadmap-progress-v1", JSON.stringify(progress));
  }, [data, progress]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sectionById = useMemo(
    () => new Map(data?.sections.map((section) => [section.id, section]) ?? []),
    [data],
  );

  const selectedNode = useMemo(
    () => data?.nodes.find((node) => node.id === selectedId) ?? null,
    [data, selectedId],
  );

  const getProgress = (node: RoadmapNode) => progress[node.id] ?? defaultProgress(node);

  const completedCount = useMemo(
    () => data?.nodes.filter((node) => getProgress(node).status === "completed").length ?? 0,
    [data, progress],
  );

  const activeCount = useMemo(
    () => data?.nodes.filter((node) => getProgress(node).status === "in_progress").length ?? 0,
    [data, progress],
  );

  const reviewCount = useMemo(
    () => data?.nodes.filter((node) => getProgress(node).status === "needs_review").length ?? 0,
    [data, progress],
  );

  const completionPercent = data ? (completedCount / data.stats.problemNodeCount) * 100 : 0;

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return data.nodes.filter((node) => {
      const section = sectionById.get(node.sectionId);
      const matchesSection = activeSection === "all" || node.sectionId === activeSection;
      const matchesStatus = statusFilter === "all" || getProgress(node).status === statusFilter;
      const searchable = `${node.label} ${node.title} ${section?.title ?? ""} ${getExcerpt(node)}`.toLowerCase();
      return matchesSection && matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [activeSection, data, progress, query, sectionById, statusFilter]);

  const nextNode = useMemo(
    () => data?.nodes.find((node) => getProgress(node).status !== "completed") ?? data?.nodes[0] ?? null,
    [data, progress],
  );

  function updateProgress(nodeId: string, patch: Partial<NodeProgress>) {
    setProgress((current) => ({
      ...current,
      [nodeId]: { ...current[nodeId], ...patch },
    }));
  }

  function setNodeStatus(node: RoadmapNode, status: Status) {
    updateProgress(node.id, { status, completed: status === "completed" });
  }

  function toggleChecklist(node: RoadmapNode, itemId: string) {
    const current = getProgress(node);
    const checklist = { ...current.checklist, [itemId]: !current.checklist[itemId] };
    const done = node.study.checklist.every((item) => checklist[item.id]);
    updateProgress(node.id, {
      checklist,
      status: done ? "completed" : current.status === "not_started" ? "in_progress" : current.status,
      completed: done,
    });
  }

  function openNode(node: RoadmapNode) {
    setSelectedId(node.id);
    setMobileNavOpen(false);
    if (getProgress(node).status === "not_started") {
      updateProgress(node.id, { status: "in_progress" });
    }
  }

  if (error) {
    return (
      <main className="load-state">
        <div className="load-card">
          <span className="eyebrow">ROADMAP / ERROR</span>
          <h1>We couldn’t load your study map.</h1>
          <p>{error}</p>
          <button className="button button-dark" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="load-state">
        <div className="loading-mark"><span /><span /><span /></div>
        <p>Loading your roadmap…</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => { setActiveSection("all"); setStatusFilter("all"); setQuery(""); }} aria-label="Reset roadmap filters">
          <span className="brand-mark">DS</span>
          <span className="brand-copy"><strong>DSA / FIELD GUIDE</strong><small>your problem-solving route</small></span>
        </button>
        <div className="topbar-actions">
          <span className="saved-indicator"><i /> Saved locally</span>
          <button className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle sections">☰</button>
          <a className="source-link" href={data.source.url} target="_blank" rel="noreferrer">Open source <span>↗</span></a>
        </div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-heading">
            <span className="eyebrow">YOUR ROUTE</span>
            <button className="close-mobile" onClick={() => setMobileNavOpen(false)} aria-label="Close sections">×</button>
          </div>
          <div className="route-summary">
            <ProgressRing value={completionPercent} size="small" />
            <div><strong>{completedCount} / {data.stats.problemNodeCount}</strong><span>problems solved</span></div>
          </div>
          <nav className="section-nav" aria-label="Roadmap sections">
            <button className={`section-nav-item ${activeSection === "all" ? "active" : ""}`} onClick={() => { setActiveSection("all"); setMobileNavOpen(false); }}>
              <span className="nav-index">00</span><span className="nav-title">All problems</span><span className="nav-count">{data.stats.problemNodeCount}</span>
            </button>
            {data.sections.map((section) => {
              const sectionDone = section.problemNodeIds.filter((id) => progress[id]?.status === "completed").length;
              return (
                <button className={`section-nav-item ${activeSection === section.id ? "active" : ""}`} key={section.id} onClick={() => { setActiveSection(section.id); setMobileNavOpen(false); }}>
                  <span className="nav-index">{String(section.order).padStart(2, "0")}</span>
                  <span className="nav-title">{section.title.replace(/ — .*$/, "")}</span>
                  <span className="nav-count">{sectionDone}/{section.problemCount}</span>
                </button>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <span className="eyebrow">CAPTURED</span>
            <p>{formatCapturedDate(data.source.capturedAt)}</p>
            <span>Community roadmap · not verified</span>
          </div>
        </aside>

        <section className="content-column">
          <div className="hero">
            <div className="hero-copy">
              <span className="eyebrow">A QUIET PLACE TO GET BETTER AT DSA</span>
              <h1>Build the instinct<br /><em>behind</em> the answer.</h1>
              <p>{data.description} Use the route, make a first attempt, then return to the source snippet with a sharper question.</p>
              <div className="hero-actions">
                {nextNode && <button className="button button-dark" onClick={() => openNode(nextNode)}>Continue with {nextNode.label.replace(/^Q\d+\. /, "")} <span>→</span></button>}
                <button className="button button-quiet" onClick={() => document.getElementById("problem-list")?.scrollIntoView({ behavior: "smooth" })}>Browse all <span>↓</span></button>
              </div>
            </div>
            <div className="hero-meter">
              <ProgressRing value={completionPercent} />
              <div className="meter-caption"><strong>{completedCount === 0 ? "Start small." : `${completedCount} in the bank.`}</strong><span>{activeCount} active · {reviewCount} to revisit</span></div>
            </div>
          </div>

          <div className="stat-strip">
            <div><span>PROBLEMS</span><strong>{data.stats.problemNodeCount}</strong></div>
            <div><span>SECTIONS</span><strong>{data.stats.sectionCount}</strong></div>
            <div><span>CODE SNIPPETS</span><strong>{data.stats.codeBlockCount}</strong></div>
            <div><span>ROUTE</span><strong>01 → 09</strong></div>
          </div>

          <section className="next-card">
            <div className="next-marker"><span>UP NEXT</span><b>01</b></div>
            <div className="next-copy">
              <span className="eyebrow">{nextNode ? sectionById.get(nextNode.sectionId)?.title : "Your next move"}</span>
              <h2>{nextNode?.title ?? "Choose a problem to begin"}</h2>
              <p>{nextNode ? getExcerpt(nextNode) : "Your roadmap is ready."}</p>
            </div>
            {nextNode && <button className="round-arrow" onClick={() => openNode(nextNode)} aria-label={`Open ${nextNode.title}`}>↗</button>}
          </section>

          <section className="problem-section" id="problem-list">
            <div className="section-heading-row">
              <div><span className="eyebrow">THE WORK</span><h2>{activeSection === "all" ? "All problems" : sectionById.get(activeSection)?.title}</h2></div>
              <span className="result-count">{filteredNodes.length} showing</span>
            </div>
            <div className="toolbar">
              <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search problems, patterns, words…" aria-label="Search problems" />{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
              <div className="filter-pills" role="group" aria-label="Filter by status">
                {(["all", "in_progress", "needs_review", "completed"] as StatusFilter[]).map((filter) => <button key={filter} className={statusFilter === filter ? "active" : ""} onClick={() => setStatusFilter(filter)}>{filter === "all" ? "All" : STATUS_SHORT[filter]}</button>)}
              </div>
            </div>
            <div className="problem-list">
              {filteredNodes.map((node) => {
                const state = getProgress(node);
                const section = sectionById.get(node.sectionId);
                return (
                  <button className="problem-card" key={node.id} onClick={() => openNode(node)}>
                    <span className="problem-number">{String(node.order).padStart(2, "0")}</span>
                    <span className="problem-main"><span className="problem-section-label">{section?.title.replace(/ — .*$/, "")}</span><strong>{node.title}</strong><span className="problem-excerpt">{getExcerpt(node)}</span></span>
                    <span className="problem-meta"><span className={`status-dot status-${state.status}`} /><span>{STATUS_SHORT[state.status]}</span><small>{getCodeCount(node)} {getCodeCount(node) === 1 ? "snippet" : "snippets"}</small></span>
                    <span className="card-arrow">↗</span>
                  </button>
                );
              })}
              {filteredNodes.length === 0 && <div className="empty-state"><span>⌁</span><h3>No problems match that view.</h3><p>Try another search or clear the filters.</p><button className="button button-light" onClick={() => { setQuery(""); setStatusFilter("all"); setActiveSection("all"); }}>Reset view</button></div>}
            </div>
          </section>
        </section>
      </div>

      {selectedNode && (() => {
        const state = getProgress(selectedNode);
        const section = sectionById.get(selectedNode.sectionId);
        return (
          <div className="drawer-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
            <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
              <div className="drawer-header"><div><span className="eyebrow">{section?.title}</span><span className="drawer-number">NODE {String(selectedNode.order).padStart(2, "0")}</span></div><button className="drawer-close" onClick={() => setSelectedId(null)} aria-label="Close problem detail">×</button></div>
              <div className="drawer-content">
                <h2 id="detail-title">{selectedNode.title}</h2>
                <p className="drawer-subtitle">{getExcerpt(selectedNode)}</p>
                <div className="drawer-status-row">
                  <label htmlFor="node-status">Status</label>
                  <select id="node-status" value={state.status} onChange={(event) => setNodeStatus(selectedNode, event.target.value as Status)}>
                    {(Object.keys(STATUS_LABELS) as Status[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                  <span className={`status-chip status-chip-${state.status}`}><i />{STATUS_LABELS[state.status]}</span>
                </div>
                <div className="source-content">{selectedNode.content.map(renderContent)}</div>
                <div className="study-panel">
                  <div className="panel-heading"><div><span className="eyebrow">STUDY LOOP</span><h3>Make it yours</h3></div><span>{Object.values(state.checklist).filter(Boolean).length}/{selectedNode.study.checklist.length}</span></div>
                  <div className="checklist">{selectedNode.study.checklist.map((item) => <label key={item.id} className={state.checklist[item.id] ? "checked" : ""}><input type="checkbox" checked={Boolean(state.checklist[item.id])} onChange={() => toggleChecklist(selectedNode, item.id)} /><span>{item.label}</span></label>)}</div>
                  <label className="notes-field"><span>Your notes</span><textarea value={state.notes} onChange={(event) => updateProgress(selectedNode.id, { notes: event.target.value })} placeholder="What pattern, invariant, or edge case should you remember?" rows={4} /></label>
                  <div className="attempt-row"><span>Attempts logged</span><div><button onClick={() => updateProgress(selectedNode.id, { attempts: Math.max(0, state.attempts - 1) })} aria-label="Decrease attempts">−</button><strong>{state.attempts}</strong><button onClick={() => updateProgress(selectedNode.id, { attempts: state.attempts + 1 })} aria-label="Increase attempts">+</button></div></div>
                </div>
              </div>
              <div className="drawer-footer"><span>Source node · {selectedNode.label}</span><button className="button button-dark" onClick={() => setSelectedId(null)}>Save & close <span>↗</span></button></div>
            </aside>
          </div>
        );
      })()}
    </main>
  );
}
