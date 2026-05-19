import type { ComponentNode, ViewDefinition } from '@burgantech/pseudo-ui';

export interface NormalizedPseudoUi {
  component: ComponentNode;
  $schema?: string;
  dataSchema?: string;
  lookups?: string[];
  uiState?: Record<string, unknown>;
}

export function normalizePseudoUiPayload(
  content: string | Record<string, unknown>,
): NormalizedPseudoUi | null {
  let raw: unknown;
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (!trimmed) return null;
    try {
      raw = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  } else if (content != null && typeof content === 'object' && !Array.isArray(content)) {
    raw = content;
  } else {
    return null;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  // Format 1: Full ViewDefinition — { $schema?, dataSchema?, view: { type: "..." } }
  if (obj.view && typeof obj.view === 'object' && !Array.isArray(obj.view)) {
    const viewNode = obj.view as Record<string, unknown>;
    if (typeof viewNode.type === 'string' && viewNode.type.trim() !== '') {
      return {
        component: viewNode as ComponentNode,
        $schema: typeof obj.$schema === 'string' ? obj.$schema : undefined,
        dataSchema: typeof obj.dataSchema === 'string' ? obj.dataSchema : undefined,
        lookups: Array.isArray(obj.lookups) ? (obj.lookups as string[]) : undefined,
        uiState:
          obj.uiState && typeof obj.uiState === 'object' && !Array.isArray(obj.uiState)
            ? (obj.uiState as Record<string, unknown>)
            : undefined,
      };
    }
  }

  // Format 2: Bare ComponentNode — { type: "Column", children: [...] }
  if (typeof obj.type === 'string' && obj.type.trim() !== '') {
    return { component: obj as ComponentNode };
  }

  return null;
}
