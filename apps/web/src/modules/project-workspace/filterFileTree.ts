import type { FileTreeNode } from '@modules/project-management/ProjectTypes';

/**
 * Recursively filters a FileTreeNode tree keeping only nodes whose name matches
 * the query (case-insensitive). Parent directories are preserved when any
 * descendant matches.
 *
 * Returns null when neither the node nor any descendant matches.
 */
export function filterFileTree(node: FileTreeNode, query: string): FileTreeNode | null {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) return node;

  const nameMatches = node.name.toLowerCase().includes(normalizedQuery);

  if (node.type === 'file') {
    return nameMatches ? node : null;
  }

  const filteredChildren = (node.children ?? [])
    .map((child) => filterFileTree(child, query))
    .filter((child): child is FileTreeNode => child !== null);

  if (filteredChildren.length > 0) {
    return { ...node, children: filteredChildren };
  }

  return nameMatches ? { ...node, children: [] } : null;
}
