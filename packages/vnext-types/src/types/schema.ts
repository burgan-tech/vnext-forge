export interface SchemaDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  type?: string;
  tags?: string[];
  schema: Record<string, unknown>;
}
