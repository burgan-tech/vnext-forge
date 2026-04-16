import type { VnextComponentType } from '@app/store/useComponentFileTypesStore';

export type ComponentFolderType =
  | 'workflows'
  | 'tasks'
  | 'schemas'
  | 'views'
  | 'functions'
  | 'extensions'
  | 'components_root';

interface ComponentFolderMeta {
  label: string;
  closedIcon: string;
  openIcon: string;
}

export const COMPONENT_FOLDER_META: Record<ComponentFolderType, ComponentFolderMeta> = {
  workflows: {
    label: 'Workflows',
    closedIcon: '/folder_icons/workflows/closed_folder.svg',
    openIcon: '/folder_icons/workflows/open_folder.svg',
  },
  tasks: {
    label: 'Tasks',
    closedIcon: '/folder_icons/tasks/closed_folder.svg',
    openIcon: '/folder_icons/tasks/open_folder.svg',
  },
  schemas: {
    label: 'Schemas',
    closedIcon: '/folder_icons/schemas/closed_folder.svg',
    openIcon: '/folder_icons/schemas/open_folder.svg',
  },
  views: {
    label: 'Views',
    closedIcon: '/folder_icons/views/closed_folder.svg',
    openIcon: '/folder_icons/views/open_folder.svg',
  },
  functions: {
    label: 'Functions',
    closedIcon: '/folder_icons/functions/closed_folder.svg',
    openIcon: '/folder_icons/functions/open_folder.svg',
  },
  extensions: {
    label: 'Extensions',
    closedIcon: '/folder_icons/extensions/closed_folder.svg',
    openIcon: '/folder_icons/extensions/open_folder.svg',
  },
  components_root: {
    label: 'Components',
    closedIcon: '/folder_icons/components_root/closed_folder.svg',
    openIcon: '/folder_icons/components_root/open_folder.svg',
  },
};

export interface ComponentFileIcon {
  icon: string;
  color: string;
}

export const COMPONENT_FILE_ICONS: Record<VnextComponentType, ComponentFileIcon> = {
  workflow: { icon: '/folder_icons/workflows/file_icons/file.svg', color: '#a78bfa' },
  task: { icon: '/folder_icons/tasks/file_icons/file.svg', color: '#f97316' },
  schema: { icon: '/folder_icons/schemas/file_icons/file.svg', color: '#06b6d4' },
  view: { icon: '/folder_icons/views/file_icons/file.svg', color: '#22c55e' },
  function: { icon: '/folder_icons/functions/file_icons/file.svg', color: '#3b82f6' },
  extension: { icon: '/folder_icons/extensions/file_icons/file.svg', color: '#f43f5e' },
};

export const VNEXT_CONFIG_FILE_ICON = '/folder_icons/config/vnext_config.svg';
