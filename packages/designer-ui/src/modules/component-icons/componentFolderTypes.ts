/**
 * Folder-level discriminator for vNext component directories shown in the
 * file tree. Mirrors the singular `VnextComponentType` (file-level) but uses
 * plural names because folders are containers, plus an extra
 * `components_root` entry for the configurable root that holds them all.
 */
export type ComponentFolderType =
  | 'workflows'
  | 'tasks'
  | 'schemas'
  | 'views'
  | 'functions'
  | 'extensions'
  | 'components_root';
