import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/project-store';

export function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, setActiveProject, setFileTree, setVnextConfig, setLoading } = useProjectStore();

  useEffect(() => {
    if (!id) return;
    loadProject(id);
  }, [id]);

  async function loadProject(projectId: string) {
    setLoading(true);
    try {
      const [projectRes, treeRes, configRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/tree`),
        fetch(`/api/projects/${projectId}/config`),
      ]);
      const project = await projectRes.json();
      const tree = await treeRes.json();
      setActiveProject(project);
      setFileTree(tree);
      if (configRes.ok) {
        const config = await configRes.json();
        setVnextConfig(config);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading project...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Projects
        </button>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-sm font-medium">{activeProject.domain}</span>
        {activeProject.linked && (
          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded">linked</span>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-lg font-semibold mb-2">{activeProject.domain}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select a file from the sidebar to start editing.
          </p>
        </div>
      </div>
    </div>
  );
}
