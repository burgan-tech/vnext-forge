import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore, type ProjectInfo } from '../stores/project-store';
import { ImportDialog } from '../project/ImportDialog';
import { FolderOpen, Plus, Link, Trash2, ArrowRight, MapPin, ChevronRight } from 'lucide-react';
import { apiClient, unwrapApi } from '@shared/api/client';

export function ProjectListPage() {
  const navigate = useNavigate();
  const { projects, setProjects, setActiveProject, setLoading, loading } = useProjectStore();
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
      const data = await unwrapApi<ProjectInfo[]>(
        await apiClient.api.projects.$get(),
        'Projects could not be loaded.',
      );
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
      const project = await unwrapApi<ProjectInfo>(
        await apiClient.api.projects.$post({
          json: body,
        }),
        'Project could not be created.',
      );
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
      const response =
        dirPath === undefined
          ? await apiClient.api.files.browse.$get({})
          : await apiClient.api.files.browse.$get({
              query: {
                path: dirPath,
              },
            });
      const data = await unwrapApi<{
        path: string;
        folders: Array<{ name: string; path: string }>;
      }>(response, 'Folders could not be loaded.');
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
      await unwrapApi(
        await apiClient.api.projects[':id'].$delete({
          param: { id: project.id },
        }),
        'Project could not be deleted.',
      );
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
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          {/* Hero */}
          <div className="mb-14 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <img src="/icon.svg" alt="vNext Forge" className="h-8 w-8" />
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Flow Studio</h1>
            <p className="text-slate-500">Visual workflow development platform</p>
          </div>

          {/* Actions */}
          <div className="mb-14 space-y-3">
            <button
              onClick={() => setImportOpen(true)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-left transition-all duration-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 transition-colors group-hover:bg-indigo-100">
                <FolderOpen size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">Import Project</div>
                <div className="text-xs text-slate-500">
                  Browse and link an existing vnext project
                </div>
              </div>
              <ArrowRight
                size={16}
                className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-400"
              />
            </button>

            <div className="w-full rounded-2xl border border-slate-200/80 bg-white px-5 py-4">
              <div className="mb-3 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                  <Plus size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Create Project</div>
                  <div className="text-xs text-slate-500">
                    Start a new vnext domain from scratch
                  </div>
                </div>
              </div>
              <div className="space-y-2 pl-14">
                <input
                  type="text"
                  placeholder="my-domain"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
                {/* Location picker */}
                <div className="relative" ref={pathPickerRef}>
                  <button
                    onClick={() => (showPathPicker ? setShowPathPicker(false) : browseForCreate())}
                    className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-left text-sm transition-colors hover:border-slate-300">
                    <MapPin size={14} className="shrink-0 text-slate-400" />
                    {createPath ? (
                      <span className="truncate font-mono text-xs text-slate-700">
                        {createPath}
                      </span>
                    ) : (
                      <span className="text-slate-400">Location (default: ~/vnext-projects)</span>
                    )}
                  </button>
                  {showPathPicker && (
                    <div className="animate-scale-in absolute top-11 right-0 left-0 z-50 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
                      {/* Breadcrumb */}
                      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                        {browsePath
                          .split('/')
                          .filter(Boolean)
                          .map((seg, i, arr) => {
                            const fullPath = '/' + arr.slice(0, i + 1).join('/');
                            return (
                              <span key={i} className="flex shrink-0 items-center gap-1">
                                {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                                <button
                                  onClick={() => browseForCreate(fullPath)}
                                  className="hover:text-indigo-500">
                                  {seg}
                                </button>
                              </span>
                            );
                          })}
                      </div>
                      {/* Select this folder */}
                      <button
                        onClick={() => {
                          setCreatePath(browsePath);
                          setShowPathPicker(false);
                        }}
                        className="w-full border-b border-slate-100 px-3 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
                        Select this folder
                      </button>
                      {/* Folders */}
                      {browseFolders.map((f) => (
                        <button
                          key={f.path}
                          onClick={() => browseForCreate(f.path)}
                          onDoubleClick={() => {
                            setCreatePath(f.path);
                            setShowPathPicker(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">
                          <FolderOpen size={13} className="shrink-0 text-slate-400" />
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
                  className="h-10 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white shadow-sm shadow-emerald-500/20 transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-md hover:shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-30">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>

          {/* Projects */}
          {hasProjects && (
            <div>
              <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                Recent Projects
              </h2>
              <div className="space-y-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openProject(p)}
                    className="group flex w-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-left transition-all duration-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50 to-violet-50 text-sm font-bold text-indigo-500">
                      {p.domain[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {p.domain}
                        </span>
                        {p.linked && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-px text-[9px] font-semibold text-indigo-500">
                            <Link size={7} />
                            linked
                          </span>
                        )}
                        {p.version && (
                          <span className="font-mono text-[10px] text-slate-400">v{p.version}</span>
                        )}
                      </div>
                      {p.description && (
                        <div className="mt-0.5 truncate text-xs text-slate-400">
                          {p.description}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDelete(e, p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent, p);
                        }}
                        className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500">
                        {deletingId === p.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-slate-200 transition-colors group-hover:text-indigo-400"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && <div className="text-center text-sm text-slate-400">Loading...</div>}
        </div>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={fetchProjects} />
    </div>
  );
}
