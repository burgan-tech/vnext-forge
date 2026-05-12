import {
  AlertTriangle,
  Code2,
  FolderTree,
  Home,
  Search,
  Settings,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useComponentStore,
  useValidationStore,
} from '@vnext-forge-studio/designer-ui';

import { useWebShellStore, type SidebarView } from '../../store/useWebShellStore';
import { useWorkspaceDiagnosticsStore } from '../../store/useWorkspaceDiagnosticsStore';

interface ActivityItem {
  id: SidebarView | 'home';
  icon: React.ReactNode;
  title: string;
}

const topItems: ActivityItem[] = [
  { id: 'home', icon: <Home size={20} />, title: 'Home' },
  { id: 'project', icon: <FolderTree size={20} />, title: 'Explorer' },
  { id: 'search', icon: <Search size={20} />, title: 'Search' },
  { id: 'snippets', icon: <Code2 size={20} />, title: 'Snippets' },
  { id: 'validation', icon: <AlertTriangle size={20} />, title: 'Problems' },
];

const bottomItems: ActivityItem[] = [
  { id: 'templates', icon: <Settings size={20} />, title: 'Settings' },
];

function useProblemsCount(): number {
  const workflowErrorCount = useValidationStore((s) => s.issues.filter((i) => i.severity === 'error').length);
  const componentErrorCount = useComponentStore((s) => s.validationErrors.length);
  const configIssueCount = useWorkspaceDiagnosticsStore((s) => s.configIssues.filter((i) => i.severity === 'error').length);
  return workflowErrorCount + componentErrorCount + configIssueCount;
}

export function ActivityBar() {
  const sidebarOpen = useWebShellStore((s) => s.sidebarOpen);
  const sidebarView = useWebShellStore((s) => s.sidebarView);
  const setSidebarView = useWebShellStore((s) => s.setSidebarView);
  const toggleSidebar = useWebShellStore((s) => s.toggleSidebar);
  const navigate = useNavigate();
  const location = useLocation();
  const problemsCount = useProblemsCount();

  function handleClick(item: ActivityItem) {
    if (item.id === 'home') {
      navigate('/');
      return;
    }

    const view = item.id as SidebarView;
    if (sidebarView === view && sidebarOpen) {
      toggleSidebar();
    } else {
      setSidebarView(view);
    }
  }

  function isActive(item: ActivityItem) {
    if (item.id === 'home') {
      return location.pathname === '/';
    }
    return sidebarOpen && sidebarView === item.id;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-chrome flex w-[52px] shrink-0 flex-col items-center py-2">
        <div className="flex flex-1 flex-col items-center gap-1">
          {topItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleClick(item)}
                  aria-label={item.id === 'validation' && problemsCount > 0 ? `${item.title}, ${problemsCount} error${problemsCount > 1 ? 's' : ''}` : item.title}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
                    isActive(item)
                      ? 'bg-chrome-item text-chrome-foreground'
                      : 'text-chrome-muted hover:bg-chrome-item-hover hover:text-chrome-foreground'
                  }`}>
                  {isActive(item) && (
                    <span className="bg-chrome-accent absolute top-1/2 left-0 h-5 w-0.75 -translate-y-1/2 rounded-r-full" />
                  )}
                  {item.icon}
                  {item.id === 'validation' && problemsCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive-surface text-[9px] font-bold text-destructive-text px-0.5">
                      {problemsCount > 99 ? '99+' : problemsCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-[11px]">
                {item.title}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1 pb-1">
          {bottomItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleClick(item)}
                  aria-label={item.title}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
                    isActive(item)
                      ? 'bg-chrome-item text-chrome-foreground'
                      : 'text-chrome-muted hover:bg-chrome-item-hover hover:text-chrome-foreground'
                  }`}>
                  {item.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-[11px]">
                {item.title}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
