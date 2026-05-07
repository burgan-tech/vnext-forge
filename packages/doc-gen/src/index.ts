export { generateWorkflowMarkdown } from './generators/workflow-doc.js';
export { generateTaskMarkdown } from './generators/task-doc.js';
export { generateFunctionMarkdown } from './generators/function-doc.js';
export { generateExtensionMarkdown } from './generators/extension-doc.js';
export { generateSchemaMarkdown } from './generators/schema-doc.js';
export { generateViewMarkdown } from './generators/view-doc.js';
export {
  generateIndexMarkdown,
  type ComponentDocEntry,
  type IndexExtraLink,
} from './generators/index-doc.js';
export { generateDependencyTreeMarkdown } from './generators/dependency-tree-doc.js';
export {
  extractWorkflowDependencies,
  extractTaskWorkflowTriggers,
  aggregateProjectGraph,
  type DependencyKind,
  type DependencyRef,
  type WorkflowDependencyReport,
  type FlowEdge,
  type ProjectDependencyGraph,
} from './analysis/dependency-extractor.js';
export { resolveLabel, resolveLabelOrKey } from './utils/label-resolver.js';
export { buildStateDiagram } from './utils/mermaid-builder.js';
export { buildFeatureMatrix } from './utils/feature-matrix.js';
export { escapeMermaidLabel } from './utils/markdown-helpers.js';
