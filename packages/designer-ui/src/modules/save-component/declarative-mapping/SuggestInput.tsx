import { ExpressionInput } from '../../../ui/ExpressionInput';
import type { ExpressionSurface } from '../../expressions/expressionCatalog';
import type { CompletionContext } from './declarativeMappingCompletions';

/** Suggestions at the caret and how to apply one of them. */
export interface SuggestState {
  items: string[];
  apply: (item: string) => { text: string; caret: number };
}

export type SuggestFn = (text: string, caret: number) => SuggestState | null;

interface SuggestInputBase {
  value: string;
  onChange: (next: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
}

export type SuggestInputProps = SuggestInputBase &
  (
    | { mode?: 'path'; suggest: SuggestFn }
    | {
        mode: 'expression';
        /** Overrides the surface's own completions. */
        suggest?: SuggestFn;
        surface?: ExpressionSurface;
        schemaRoot?: unknown;
        completionContext?: CompletionContext;
      }
  );

/**
 * Single-line input with a suggestion list (↑/↓ move, Enter or Tab inserts, Esc closes), rendered by
 * `ExpressionInput`. `mode="path"` (default) highlights a `$.a.b` path and needs `suggest`; `mode="expression"`
 * highlights Dynamic Expresso for `surface`. `onCommit` fires on blur / Enter for inputs that apply their value
 * only when done (a `set` key); otherwise `onChange` fires per keystroke.
 */
export function SuggestInput(props: SuggestInputProps) {
  const { value, onChange, onCommit, placeholder, ariaLabel, invalid } = props;
  const common = { value, onChange, onCommit, placeholder, ariaLabel, invalid };
  if (props.mode === 'expression') {
    return (
      <ExpressionInput
        {...common}
        mode="expression"
        suggest={props.suggest}
        surface={props.surface}
        schemaRoot={props.schemaRoot}
        completionContext={props.completionContext}
      />
    );
  }
  return <ExpressionInput {...common} mode="path" suggest={props.suggest} />;
}
