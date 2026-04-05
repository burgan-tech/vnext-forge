import { Label } from './label';
import { ResourceReference } from './state';

export type DisplayStrategy = 'full-page' | 'popup' | 'bottom-sheet' | 'top-sheet' | 'drawer' | 'inline';

export interface PlatformOverride {
  platform: 'web' | 'ios' | 'android';
  content: unknown;
  display?: DisplayStrategy;
}

export interface ViewDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  type?: number;
  display?: DisplayStrategy;
  content?: unknown;
  labels?: Label[];
  platformOverrides?: PlatformOverride[];
  loadData?: boolean;
  extensions?: ResourceReference[];
}
