import * as React from 'react';

/**
 * When true, form primitives (Input, Textarea, Select, KVEditor, TagEditor,
 * ComponentDescriptionField) render as "quiet read-only": values keep the
 * designer form look and stay selectable/copyable, but nothing is editable
 * and row/tag action buttons are not rendered.
 *
 * Default is false and no forge shell mounts the provider, so editor
 * behavior is unchanged unless a host opts in (e.g. monitoring detail pages).
 */
const FormReadOnlyContext = React.createContext<boolean>(false);

export function FormReadOnlyProvider({ children }: { children: React.ReactNode }) {
  return <FormReadOnlyContext.Provider value={true}>{children}</FormReadOnlyContext.Provider>;
}

export function useFormReadOnly(): boolean {
  return React.useContext(FormReadOnlyContext);
}
