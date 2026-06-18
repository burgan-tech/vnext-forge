import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ChevronDown,
  Clock,
  LayoutDashboard,
  Settings,
  Star,
  X,
  Zap,
} from 'lucide-react';

import { cn } from '@monitoring/shared/lib/utils';
import { config } from '@monitoring/shared/config/config';
import { useFavorites } from '@monitoring/app/favorites/useFavorites';
import { ComponentBadgeIcon } from '@monitoring/shared/components/ComponentBadgeIcon';

const DEFINITION_TYPES = [
  { label: 'Workflows', key: 'workflow' },
  { label: 'Tasks', key: 'task' },
  { label: 'Functions', key: 'function' },
  { label: 'Views', key: 'view' },
  { label: 'Extensions', key: 'extension' },
  { label: 'Schemas', key: 'schema' },
  { label: 'Mappings', key: 'mapping' },
] as const;

export function Sidebar() {
  const [definitionsOpen, setDefinitionsOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const { favorites, removeFavorite } = useFavorites();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-56 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
          vN
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-100">vNext</div>
          <div className="font-mono text-[11px] text-slate-500">Monitoring</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        {/* Monitor */}
        <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Monitor
        </p>
        <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" exact />
        <SidebarLink to="/task-executions" icon={Activity} label="Task Executions" />
        <SidebarLink to="/function-executions" icon={Zap} label="Fn Executions" />
        <SidebarLink to="/faults" icon={AlertCircle} label="Faults" />
        <SidebarLink to="/jobs" icon={Clock} label="Jobs" />

        {/* Definitions */}
        <button
          onClick={() => setDefinitionsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400"
        >
          Definitions
          <ChevronDown
            className={cn('h-3 w-3 transition-transform duration-150', definitionsOpen && 'rotate-180')}
          />
        </button>
        {definitionsOpen &&
          DEFINITION_TYPES.map(({ label, key }) => (
            <NavLink
              key={key}
              to={`/definitions/${key}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-sm py-1.5 pl-6 pr-2 text-sm transition-colors',
                  isActive
                    ? 'bg-slate-700/60 text-slate-100 font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                )
              }
            >
              <ComponentBadgeIcon type={key} className="h-5 w-5" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}

        {/* Favorites */}
        {favorites.length > 0 && (
          <>
            <button
              onClick={() => setFavoritesOpen((o) => !o)}
              className="flex w-full items-center justify-between px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400"
            >
              Favorites
              <ChevronDown
                className={cn('h-3 w-3 transition-transform duration-150', favoritesOpen && 'rotate-180')}
              />
            </button>
            {favoritesOpen &&
              favorites.map((fav) => (
                <div key={fav.path} className="group flex items-center">
                  <NavLink
                    to={fav.path}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-slate-700/60 text-slate-100 font-medium'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                      )
                    }
                  >
                    <Star className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{fav.label}</span>
                  </NavLink>
                  <button
                    onClick={() => removeFavorite(fav.path)}
                    className="mr-1 hidden h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:text-slate-300 group-hover:flex"
                    aria-label={`Remove ${fav.label} from favorites`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
          </>
        )}
      </div>

      {/* Config + Footer */}
      <div className="border-t border-slate-800">
        <SidebarLink to="/config" icon={Settings} label="Config" />
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-500" />
          <span className="truncate font-mono text-[11px] text-slate-500">
            {config.domain} · production
          </span>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  indent = false,
  exact = false,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  indent?: boolean;
  exact?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-sm py-1.5 text-sm transition-colors',
          indent ? 'pl-6 pr-2' : 'px-2',
          isActive
            ? 'bg-slate-700/60 text-slate-100 font-medium'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
