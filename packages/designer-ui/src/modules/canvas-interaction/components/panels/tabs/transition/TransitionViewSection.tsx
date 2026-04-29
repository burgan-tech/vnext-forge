import type { ViewBinding } from '@vnext-forge/vnext-types';
import { ViewBindingsSection } from '../shared/ViewBindingsSection';

export interface TransitionViewSectionProps {
  view: ViewBinding | null;
  views: ViewBinding[];
  onUpdateView: (view: ViewBinding | null) => void;
  onUpdateViews: (views: ViewBinding[]) => void;
  onBrowseView: (bindingIndex: number | null) => void;
  onCreateView: (bindingIndex: number | null) => void;
  onBrowseExtension: (bindingIndex: number | null) => void;
  canPickExisting: boolean;
  stateKey: string;
  transitionKey: string;
  transitionIndex: number;
}

export function TransitionViewSection({
  view,
  views,
  onUpdateView,
  onUpdateViews,
  onBrowseView,
  onCreateView,
  onBrowseExtension,
  canPickExisting,
  stateKey,
  transitionKey,
  transitionIndex,
}: TransitionViewSectionProps) {
  return (
    <ViewBindingsSection
      view={view}
      views={views}
      onUpdateView={onUpdateView}
      onUpdateViews={onUpdateViews}
      onBrowseView={onBrowseView}
      onCreateView={onCreateView}
      onBrowseExtension={onBrowseExtension}
      canPickExisting={canPickExisting}
      contextId={`${stateKey}-${transitionKey}-${transitionIndex}`}
      scriptFieldPrefix={`views`}
      stateKey={stateKey}
      listField="transitions"
      listIndex={transitionIndex}
      description="Assign a view to this transition. Use rule-based mode for conditional view selection."
    />
  );
}
