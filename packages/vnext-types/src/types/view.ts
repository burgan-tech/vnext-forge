import { Label } from './label';
import { ResourceReference } from './state';
import { ViewType } from '../constants/view-types';

export type DisplayStrategy = 'full-page' | 'popup' | 'bottom-sheet' | 'top-sheet' | 'drawer' | 'inline';

export interface PlatformOverride {
  platform: 'web' | 'ios' | 'android';
  content: unknown;
  display?: DisplayStrategy;
  type?: ViewType;
}

export interface ViewDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  type?: ViewType;
  display?: DisplayStrategy;
  content?: unknown;
  labels?: Label[];
  platformOverrides?: PlatformOverride[];
  loadData?: boolean;
  extensions?: ResourceReference[];
}
