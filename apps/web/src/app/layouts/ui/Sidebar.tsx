import { Input } from '@vnext-forge/designer-ui/ui';

import { ProjectWorkspaceSidebarPanel } from '../../../modules/project-workspace';
import { useWebShellStore } from '../../store/useWebShellStore';

export function Sidebar() {
  const sidebarView = useWebShellStore((s) => s.sidebarView);

  return (
    <div className="flex h-full flex-col">
      <div className="text-muted-foreground px-4 py-3 text-[11px] font-semibold tracking-widest uppercase">
        {sidebarView === 'project' && 'Explorer'}
        {sidebarView === 'search' && 'Search'}
        {sidebarView === 'validation' && 'Problems'}
        {sidebarView === 'templates' && 'Settings'}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sidebarView === 'project' && <ProjectWorkspaceSidebarPanel />}

        {sidebarView === 'search' && (
          <div className="mt-2 px-3">
            <Input size="sm" placeholder="Search files..." />
            <div className="text-muted-foreground mt-6 text-center text-[10px]">
              Type to search across project files
            </div>
          </div>
        )}

        {sidebarView === 'validation' && (
          <div className="text-muted-foreground mt-12 px-4 text-center text-xs">
            No problems detected
          </div>
        )}

        {sidebarView === 'templates' && (
          <div className="text-muted-foreground mt-12 px-4 text-center text-xs">
            Settings coming soon
          </div>
        )}
      </div>
    </div>
  );
}
