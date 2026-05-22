import { ViewRenderer } from '@vnext-forge-studio/vnext-types';

import { CopyableJsonBlock } from '../components/CopyableJsonBlock';
import type { ViewResponse } from '../types/quickrun.types';
import { PseudoUiViewSurface } from './PseudoUiViewSurface';
import type { SchemaResolver } from './createDataSchemaResolver';
import type { DataSchema, PseudoViewDelegate } from '@burgantech/pseudo-ui';
import { usePseudoUiPanelMode, ViewModeToggle } from './ViewModeToggle';

export interface PseudoUiOrJsonBlockProps {
  view: ViewResponse;
  jsonValue: unknown;
  displayContent: string;
  ariaLabel: string;
  integrationMode: 'simulation' | 'preview';
  fillHeight?: boolean;
  surfaceClassName?: string;
  panelStorageScope?: string;
  delegate?: PseudoViewDelegate;
  pseudoUiSchema?: DataSchema;
  resolveSchema?: SchemaResolver;
  instanceData?: Record<string, unknown>;
  initialFormData?: Record<string, unknown>;
  onPseudoError?: (message: string) => void;
}

function JsonBranch({
  jsonValue,
  displayContent,
  fillHeight,
}: {
  jsonValue: unknown;
  displayContent: string;
  fillHeight?: boolean;
}) {
  if (jsonValue != null) {
    return <CopyableJsonBlock value={jsonValue} fillHeight={fillHeight} />;
  }
  return <CopyableJsonBlock value={displayContent || '(empty)'} fillHeight={fillHeight} />;
}

export function PseudoUiOrJsonBlock({
  view,
  jsonValue,
  displayContent,
  ariaLabel,
  integrationMode,
  fillHeight,
  surfaceClassName,
  panelStorageScope = 'default',
  delegate,
  pseudoUiSchema,
  resolveSchema,
  instanceData,
  initialFormData,
  onPseudoError,
}: PseudoUiOrJsonBlockProps) {
  const [panelMode, setPanelMode] = usePseudoUiPanelMode(panelStorageScope);

  if (view.renderer !== ViewRenderer.PseudoUi) {
    return <JsonBranch jsonValue={jsonValue} displayContent={displayContent} fillHeight={fillHeight} />;
  }

  return (
    <div className={fillHeight ? 'flex min-h-0 flex-1 flex-col gap-2' : 'flex flex-col gap-2'}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
          Rendered view
        </span>
        <ViewModeToggle mode={panelMode} onModeChange={setPanelMode} />
      </div>
      {panelMode === 'json' ? (
        <JsonBranch jsonValue={jsonValue} displayContent={displayContent} fillHeight={fillHeight} />
      ) : (
        <PseudoUiViewSurface
          viewResponse={view}
          schema={pseudoUiSchema}
          resolveSchema={resolveSchema}
          instanceData={instanceData}
          initialFormData={initialFormData}
          mode={integrationMode}
          ariaLabel={ariaLabel}
          fillHeight={fillHeight}
          className={surfaceClassName}
          delegate={delegate}
          onError={onPseudoError}
        />
      )}
    </div>
  );
}
