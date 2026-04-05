import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore, type ProjectInfo } from '../stores/project-store';
import { ImportDialog } from '../project/ImportDialog';
import {
  FolderOpen,
  Plus,
  Link,
  Trash2,
  ArrowRight,
  MapPin,
  ChevronRight,
} from 'lucide-react';

export function ProjectListPage() {
  const navigate = useNavigate();
  const { projects, setProjects, setActiveProject, setLoading, loading } =
    useProjectStore();
  const [newDomain, setNewDomain] = useState('');
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createPath, setCreatePath] = useState('');
  const [showPathPicker, setShowPathPicker] = useState(false);
  const [browseFolders, setBrowseFolders] = useState<Array<{ name: string; path: string }>>([]);
  const [browsePath, setBrowsePath] = useState('');
  const pathPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  // Close path picker on outside click
  useEffect(() => {
    if (!showPathPicker) return;
    const handler = (e: MouseEvent) => {
      if (pathPickerRef.current && !pathPickerRef.current.contains(e.target as Node)) {
        setShowPathPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPathPicker]);

  async function fetchProjects() {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newDomain.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, string> = { domain: newDomain.trim() };
      if (createPath) body.targetPath = createPath;
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const project = await res.json();
      await fetchProjects();
      openProject(project);
    } finally {
      setCreating(false);
      setNewDomain('');
      setCreatePath('');
    }
  }

  async function browseForCreate(dirPath?: string) {
    try {
      const url = dirPath
        ? `/api/files/browse?path=${encodeURIComponent(dirPath)}`
        : '/api/files/browse';
      const res = await fetch(url);
      const data = await res.json();
      setBrowsePath(data.path ?? '');
      setBrowseFolders(data.folders);
      setShowPathPicker(true);
    } catch {
      // ignore
    }
  }

  async function handleDelete(e: React.MouseEvent, project: ProjectInfo) {
    e.stopPropagation();
    setDeletingId(project.id);
    try {
      await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      await fetchProjects();
    } finally {
      setDeletingId(null);
    }
  }

  function openProject(project: ProjectInfo) {
    setActiveProject(project);
    navigate(`/project/${project.id}`);
  }

  const hasProjects = !loading && projects.length > 0;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">

          {/* Hero */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 mb-6">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="6" r="2" />
                <circle cx="19" cy="6" r="2" />
                <circle cx="12" cy="18" r="2" />
                <path d="M5 8v2a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4V8" />
                <path d="M12 14v4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Flow Studio</h1>
            <p className="text-slate-500">Visual workflow development platform</p>
          </div>

          {/* Actions */}
          <div className="space-y-3 mb-14">
            <button
              onClick={() => setImportOpen(true)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 text-left transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                <FolderOpen size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">Import Project</div>
                <div className="text-xs text-slate-500">Browse and link an existing vnext project</div>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            <div className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200/80">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                  <Plus size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Create Project</div>
                  <div className="text-xs text-slate-500">Start a new vnext domain from scratch</div>
                </div>
              </div>
              <div className="space-y-2 pl-14">
                <input
                  type="text"
                  placeholder="my-domain"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
                />
                {/* Location picker */}
                <div className="relative" ref={pathPickerRef}>
                  <button
                    onClick={() => showPathPicker ? setShowPathPicker(false) : browseForCreate()}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-left flex items-center gap-2 hover:border-slate-300 transition-colors"
                  >
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    {createPath ? (
                      <span className="text-slate-700 truncate text-xs font-mono">{createPath}</span>
                    ) : (
                      <span className="text-slate-400">Location (default: ~/vnext-projects)</span>
                    )}
                  </button>
                  {showPathPicker && (
                    <div className="absolute left-0 right-0 top-11 z-50 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/5 max-h-60 overflow-y-auto animate-scale-in">
                      {/* Breadcrumb */}
                      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1 text-xs text-slate-500 overflow-x-auto">
                        {browsePath.split('/').filter(Boolean).map((seg, i, arr) => {
                          const fullPath = '/' + arr.slice(0, i + 1).join('/');
                          return (
                            <span key={i} className="flex items-center gap-1 shrink-0">
                              {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                              <button onClick={() => browseForCreate(fullPath)} className="hover:text-indigo-500">{seg}</button>
                            </span>
                          );
                        })}
                      </div>
                      {/* Select this folder */}
                      <button
                        onClick={() => { setCreatePath(browsePath); setShowPathPicker(false); }}
                        className="w-full px-3 py-2 text-xs text-left text-indigo-600 font-semibold hover:bg-indigo-50 border-b border-slate-100"
                      >
                        Select this folder
                      </button>
                      {/* Folders */}
                      {browseFolders.map((f) => (
                        <button
                          key={f.path}
                          onClick={() => browseForCreate(f.path)}
                          onDoubleClick={() => { setCreatePath(f.path); setShowPathPicker(false); }}
                          className="w-full px-3 py-1.5 text-xs text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <FolderOpen size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                      {browseFolders.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No subfolders</div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newDomain.trim()}
                  className="w-full h-10 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-30 transition-all shadow-sm shadow-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/25 active:scale-[0.98]"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>

          {/* Projects */}
          {hasProjects && (
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Recent Projects
              </h2>
              <div className="space-y-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openProject(p)}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 text-left transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-500 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100/80">
                      {p.domain[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{p.domain}</span>
                        {p.linked && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-md text-[9px] font-semibold bg-indigo-50 text-indigo-500">
                            <Link size={7} />
                            linked
                          </span>
                        )}
                        {p.version && (
                          <span className="text-[10px] text-slate-400 font-mono">v{p.version}</span>
                        )}
                      </div>
                      {p.description && (
                        <div className="text-xs text-slate-400 truncate mt-0.5">{p.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDelete(e, p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent, p);
                        }}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        {deletingId === p.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </div>
                      <ArrowRight size={14} className="text-slate-200 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center text-sm text-slate-400">Loading...</div>
          )}

        </div>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchProjects}
      />
    </div>
  );
}
