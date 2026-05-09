import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type PublishFileFn = (filePath: string) => void | Promise<void>;

const PublishContext = createContext<PublishFileFn | null>(null);

export interface PublishProviderProps {
  onPublishFile: PublishFileFn;
  /**
   * When false, the publish affordance stays hidden (`canPublish === false`).
   * Web shells use this when the Workflow CLI is not installed.
   */
  publishEnabled?: boolean;
  children: ReactNode;
}

/**
 * Provides a host-level "publish file" capability to nested editors.
 *
 * In VS Code extension mode, `onPublishFile` posts a `host:publish` message
 * to the extension host. In web mode, omit this provider unless the shell
 * implements publish (otherwise `canPublish` is false).
 *
 * Returning a `Promise` from `onPublishFile` keeps the in-flight publishing
 * state visible until async work completes (CLI / network).
 */
export function PublishProvider({
  onPublishFile,
  publishEnabled = true,
  children,
}: PublishProviderProps) {
  const value = publishEnabled ? onPublishFile : null;
  return <PublishContext.Provider value={value}>{children}</PublishContext.Provider>;
}

/**
 * Hook consumed by editor views to wire a "Publish" button.
 *
 * Returns `{ publish, publishing, canPublish }`.
 * - `publish(save, filePath)` saves the file first, then invokes the
 *   host-level publish callback.
 * - `canPublish` is `false` when `PublishProvider` is absent, `publishEnabled` is
 *   false, or the web shell omits publish wiring.
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
        await Promise.resolve(publishFile(filePath));
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
