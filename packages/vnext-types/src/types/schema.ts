import type { Label } from './label';

export interface SchemaDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  type?: string;
  labels?: Label[];
  tags?: string[];
  schema: Record<string, unknown>;
}
