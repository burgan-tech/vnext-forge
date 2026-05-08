import { useSettingsStore } from '@vnext-forge-studio/designer-ui';
import { Accordion, Checkbox, ColorThemeSwitchSidebar, Input, Label } from '@vnext-forge-studio/designer-ui/ui';
import { Palette, Save } from 'lucide-react';

import { ProjectWorkspaceSidebarPanel } from '../../../modules/project-workspace';
import { useWebShellStore } from '../../store/useWebShellStore';

export function Sidebar() {
  const sidebarView = useWebShellStore((s) => s.sidebarView);
  const colorTheme = useSettingsStore((s) => s.colorTheme);
  const setColorTheme = useSettingsStore((s) => s.setColorTheme);
  const autoSaveEnabled = useSettingsStore((s) => s.autoSaveEnabled);
  const setAutoSaveEnabled = useSettingsStore((s) => s.setAutoSaveEnabled);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
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
          <div className="px-3 pt-2">
            <Accordion
              allowMultiple={false}
              chrome
              density="inline"
              defaultOpenItemIds={[]}
              items={[
                {
                  id: 'appearance',
                  title: 'Appearance',
                  icon: <Palette className="size-3.5" strokeWidth={2} aria-hidden />,
                  content: (
                    <ColorThemeSwitchSidebar
                      compact
                      variant="plain"
                      value={colorTheme}
                      onChange={setColorTheme}
                    />
                  ),
                },
                {
                  id: 'editor',
                  title: 'Editor',
                  icon: <Save className="size-3.5" strokeWidth={2} aria-hidden />,
                  content: (
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox
                        id="auto-save-toggle"
                        checked={autoSaveEnabled}
                        onCheckedChange={(checked) => setAutoSaveEnabled(checked === true)}
                      />
                      <Label
                        htmlFor="auto-save-toggle"
                        className="text-[11px] font-medium leading-tight cursor-pointer select-none">
                        Enable Auto Save
                      </Label>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
