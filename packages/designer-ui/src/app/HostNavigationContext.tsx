import { createContext, useContext, type ReactNode } from 'react';

/**
 * Navigation actions a host shell can expose to designer-ui components.
 *
 * The shared UI must work in two very different shells:
 *
 * - The **web SPA** owns a React Router instance and can navigate freely
 *   between pages (`/project/:id`, `/project/:id/flow/...`, etc.).
 * - The **VS Code webview** has no router. Navigation between editors is
 *   driven by the host (file clicks, command palette). Inside a single
 *   editor view, "navigate back to project" is meaningless — the user
 *   simply closes the panel or clicks a different file in the explorer.
 *
 * Components inside `@vnext-forge/designer-ui` therefore do not import
 * `react-router-dom` directly. Instead they ask for the optional
 * navigation contract via {@link useProjectNavigation}. If the host wires
 * a provider, navigation is enabled; otherwise the corresponding UI
 * affordances (breadcrumb back-links, etc.) gracefully degrade.
 */
export interface ProjectNavigation {
  /**
   * Navigate to the workspace view of a project. The web shell maps this
   * to `navigate('/project/:id')`. Hosts without a router can leave it
   * undefined and the calling component will hide the affordance.
   */
  navigateToProject(projectId: string): void;
}

const ProjectNavigationContext = createContext<ProjectNavigation | null>(null);

export interface ProjectNavigationProviderProps {
  navigation: ProjectNavigation;
  children: ReactNode;
}

/**
 * Provide a project-navigation contract to designer-ui components.
 * Wrapped at the top of the web SPA shell; the VS Code webview omits it.
 */
export function ProjectNavigationProvider({
  navigation,
  children,
}: ProjectNavigationProviderProps) {
  return (
    <ProjectNavigationContext.Provider value={navigation}>
      {children}
    </ProjectNavigationContext.Provider>
  );
}

/**
 * Read the optional navigation contract. Returns `null` when no host
 * provider is mounted (e.g. inside the VS Code webview), so callers can
 * gracefully hide router-driven affordances.
 */
export function useProjectNavigation(): ProjectNavigation | null {
  return useContext(ProjectNavigationContext);
}
