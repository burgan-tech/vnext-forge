import { FolderTree, Search, AlertTriangle, Settings, Home } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore, type SidebarView } from '../stores/ui-store';

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
  const { sidebarView, setSidebarView, sidebarOpen, toggleSidebar } = useUIStore();
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
    if (item.id === 'home') return location.pathname === '/';
    return sidebarOpen && sidebarView === item.id;
  }

  return (
    <div className="w-[52px] bg-slate-900 flex flex-col items-center py-2 shrink-0">
      <div className="flex-1 flex flex-col items-center gap-1">
        {topItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item)}
            title={item.title}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 relative ${
              isActive(item)
                ? 'text-white bg-white/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
          >
            {isActive(item) && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-400 rounded-r-full" />
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
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 ${
              isActive(item)
                ? 'text-white bg-white/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
