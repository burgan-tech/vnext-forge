import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type PublishFileFn = (filePath: string) => void;

const PublishContext = createContext<PublishFileFn | null>(null);

export interface PublishProviderProps {
  onPublishFile: PublishFileFn;
  children: ReactNode;
}

/**
 * Provides a host-level "publish file" capability to nested editors.
 *
 * In VS Code extension mode, `onPublishFile` posts a `host:publish` message
 * to the extension host. In web mode, this provider is not mounted and
 * `usePublish` returns no-op state (publish button hidden).
 */
export function PublishProvider({ onPublishFile, children }: PublishProviderProps) {
  return <PublishContext.Provider value={onPublishFile}>{children}</PublishContext.Provider>;
}

/**
 * Hook consumed by editor views to wire a "Publish" button.
 *
 * Returns `{ publish, publishing, canPublish }`.
 * - `publish(save, filePath)` saves the file first, then invokes the
 *   host-level publish callback.
 * - `canPublish` is `false` when no `PublishProvider` is mounted (web shell).
 */
export function usePublish() {
  const publishFile = useContext(PublishContext);
  const [publishing, setPublishing] = useState(false);

  const publish = useCallback(
    async (save: () => Promise<void>, filePath: string | null) => {
      if (!publishFile || !filePath) return;
      setPublishing(true);
      try {
        await save();
        publishFile(filePath);
      } finally {
        setPublishing(false);
      }
    },
    [publishFile],
  );

  return {
    publish,
    publishing,
    canPublish: publishFile != null,
  };
}
