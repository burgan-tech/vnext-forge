import { create } from 'zustand';

import {
  generateTestData,
  generateTestDataForSchemaComponent,
} from './TestDataApi.js';
import type {
  SchemaComponentEntry,
  TestDataGenerateForComponentResult,
  TestDataGenerateResult,
} from './TestDataTypes.js';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface TestDataStoreState {
  isOpen: boolean;
  /** Project the picker is currently scoped to. */
  projectId: string | null;
  /** Project's Schema components, loaded once per `open(projectId)`. */
  schemas: SchemaComponentEntry[];
  /** Free-text filter typed by the user (matched against label / path). */
  query: string;
  /** Currently-selected schema in the list. */
  selectedKey: string | null;
  /** Last generation result; rendered in the right pane. */
  result: TestDataGenerateForComponentResult | TestDataGenerateResult | null;
  status: Status;
  /** Last error string (cleared on next successful action). */
  error?: string;

  // ── lifecycle ────────────────────────────────────────────────────────────
  open(projectId: string | null): void;
  close(): void;
  toggle(projectId: string | null): void;

  // ── data ────────────────────────────────────────────────────────────────
  setSchemas(schemas: SchemaComponentEntry[]): void;
  setQuery(query: string): void;
  setSelectedKey(key: string | null): void;

  // ── actions ─────────────────────────────────────────────────────────────
  generateForSelected(options?: { seed?: number | string }): Promise<void>;
  generateFromArbitrary(
    schema: Record<string, unknown>,
    options?: { seed?: number | string },
  ): Promise<void>;
}

function entryKey(entry: SchemaComponentEntry): string {
  return `${entry.group}/${entry.name}`;
}

export const useTestDataStore = create<TestDataStoreState>((set, get) => ({
  isOpen: false,
  projectId: null,
  schemas: [],
  query: '',
  selectedKey: null,
  result: null,
  status: 'idle',
  error: undefined,

  open(projectId) {
    set({ isOpen: true, projectId, query: '', error: undefined });
  },
  close() {
    set({ isOpen: false });
  },
  toggle(projectId) {
    set((s) =>
      s.isOpen
        ? { isOpen: false }
        : { isOpen: true, projectId, query: '', error: undefined },
    );
  },

  setSchemas(schemas) {
    const first = schemas[0];
    set({
      schemas,
      selectedKey: first ? entryKey(first) : null,
    });
  },
  setQuery(query) {
    set({ query });
  },
  setSelectedKey(key) {
    set({ selectedKey: key });
  },

  async generateForSelected(options) {
    const { projectId, selectedKey, schemas } = get();
    if (!projectId || !selectedKey) return;
    const entry = schemas.find((s) => entryKey(s) === selectedKey);
    if (!entry) return;
    set({ status: 'loading', error: undefined });
    try {
      const result = await generateTestDataForSchemaComponent({
        projectId,
        group: entry.group,
        name: entry.name,
        ...(options ? { options } : {}),
      });
      set({ result, status: 'ready' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Test data generation failed.';
      set({ status: 'error', error: message });
    }
  },

  async generateFromArbitrary(schema, options) {
    set({ status: 'loading', error: undefined });
    try {
      const result = await generateTestData(schema, options);
      set({ result, status: 'ready' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Test data generation failed.';
      set({ status: 'error', error: message });
    }
  },
}));
