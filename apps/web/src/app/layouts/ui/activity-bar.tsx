import { AlertTriangle, FolderTree, Home, Search, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useUIStore, type SidebarView } from '@app/store/ui-store';

interface ActivityItem {
  id: SidebarView | 'home';
  icon: React.ReactNode;
  title: string;
}

const topItems: ActivityItem[] = [
  { id: 'home', icon: <Home size={20} />, title: 'Home' },
  { id: 'project', icon: <FolderTree size={20} />, title: 'Explorer' },
  { id: 'search', icon: <Search size={20} />, title: 'Search' },
  { id: 'validation', icon: <AlertTriangle size={20} />, title: 'Problems' },
];

const bottomItems: ActivityItem[] = [
  { id: 'templates', icon: <Settings size={20} />, title: 'Settings' },
];

export function ActivityBar() {
  const { sidebarOpen, sidebarView, setSidebarView, toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

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
    <div className="bg-chrome flex w-[52px] shrink-0 flex-col items-center py-2">
      <div className="flex flex-1 flex-col items-center gap-1">
        {topItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item)}
            title={item.title}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
              isActive(item)
                ? 'bg-chrome-item text-chrome-foreground'
                : 'text-chrome-muted hover:bg-chrome-item-hover hover:text-chrome-foreground'
            }`}>
            {isActive(item) && (
              <span className="bg-chrome-accent absolute top-1/2 left-0 h-5 w-0.75 -translate-y-1/2 rounded-r-full" />
            )}
            {item.icon}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 pb-1">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item)}
            title={item.title}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
              isActive(item)
                ? 'bg-chrome-item text-chrome-foreground'
                : 'text-chrome-muted hover:bg-chrome-item-hover hover:text-chrome-foreground'
            }`}>
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
