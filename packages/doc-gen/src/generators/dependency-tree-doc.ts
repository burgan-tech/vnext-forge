import {
  heading,
  bold,
  inlineCode,
  table,
  lines,
  callout,
  escapeMermaid,
  escapeMermaidLabel,
} from '../utils/markdown-helpers.js';
import type { ProjectDependencyGraph, FlowEdge } from '../analysis/dependency-extractor.js';

function buildOverviewSection(graph: ProjectDependencyGraph): string {
  const totalWorkflows = graph.workflows.length;
  const allCrossDomain = graph.workflows.flatMap((w) =>
    w.refs.filter((r) => r.crossDomain),
  );
  const externalDomains = [...new Set(allCrossDomain.map((r) => r.domain))].sort();

  const parts: string[] = [];
  parts.push(heading(2, 'Overview'));
  parts.push(
    table(
      ['Metric', 'Value'],
      [
        ['Total Workflows', String(totalWorkflows)],
        ['Total Cross-Domain References', String(allCrossDomain.length)],
        ['External Domains', externalDomains.length ? externalDomains.map((d) => inlineCode(d)).join(', ') : '-'],
        ['Inter-Flow Edges', String(graph.flowEdges.length)],
      ],
    ),
  );

  return parts.join('\n\n');
}

interface CrossDomainGroup {
  sourceDomain: string;
  targetDomain: string;
  entries: Array<{ workflowKey: string; refKey: string; kind: string }>;
}

function buildCrossDomainSection(graph: ProjectDependencyGraph): string | null {
  const groups = new Map<string, CrossDomainGroup>();

  for (const report of graph.workflows) {
    for (const ref of report.refs) {
      if (!ref.crossDomain) continue;
      const pairKey = `${report.workflowDomain} -> ${ref.domain}`;
      let group = groups.get(pairKey);
      if (!group) {
        group = {
          sourceDomain: report.workflowDomain,
          targetDomain: ref.domain,
          entries: [],
        };
        groups.set(pairKey, group);
      }
      group.entries.push({
        workflowKey: report.workflowKey,
        refKey: ref.key,
        kind: ref.kind,
      });
    }
  }

  if (groups.size === 0) return null;

  const parts: string[] = [];
  parts.push(heading(2, 'Cross-Domain Dependencies'));

  const sortedGroups = [...groups.values()].sort((a, b) =>
    `${a.sourceDomain}${a.targetDomain}`.localeCompare(
      `${b.sourceDomain}${b.targetDomain}`,
    ),
  );

  for (const group of sortedGroups) {
    parts.push(
      heading(
        3,
        `${inlineCode(group.sourceDomain)} \u2192 ${inlineCode(group.targetDomain)}`,
      ),
    );

    // Deduplicate entries for display
    const seen = new Set<string>();
    const uniqueEntries = group.entries.filter((e) => {
      const id = `${e.workflowKey}|${e.refKey}|${e.kind}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const rows = uniqueEntries.map((e) => [
      inlineCode(e.workflowKey),
      inlineCode(e.refKey),
      e.kind,
    ]);
    parts.push(table(['Workflow', 'Referenced Component', 'Type'], rows));
  }

  return parts.join('\n\n');
}

function buildDependencyMermaid(graph: ProjectDependencyGraph): string | null {
  if (graph.flowEdges.length === 0) return null;

  const diagramLines: string[] = ['flowchart LR'];

  // Collect all domains that appear as source or target in edges
  const domainWorkflows = new Map<string, Set<string>>();
  for (const edge of graph.flowEdges) {
    if (!domainWorkflows.has(edge.sourceDomain)) {
      domainWorkflows.set(edge.sourceDomain, new Set());
    }
    domainWorkflows.get(edge.sourceDomain)!.add(edge.sourceKey);

    if (!domainWorkflows.has(edge.targetDomain)) {
      domainWorkflows.set(edge.targetDomain, new Set());
    }
    domainWorkflows.get(edge.targetDomain)!.add(edge.targetKey);
  }

  const sortedDomains = [...domainWorkflows.keys()].sort();

  for (const domain of sortedDomains) {
    const domainId = escapeMermaid(domain);
    const workflows = [...domainWorkflows.get(domain)!].sort();
    diagramLines.push(`  subgraph ${domainId} [${escapeMermaidLabel(domain)}]`);
    for (const wf of workflows) {
      const nodeId = escapeMermaid(`${domain}_${wf}`);
      diagramLines.push(`    ${nodeId}[${escapeMermaidLabel(wf)}]`);
    }
    diagramLines.push('  end');
  }

  // Deduplicate edges for the diagram
  const edgeSet = new Set<string>();
  for (const edge of graph.flowEdges) {
    const sourceId = escapeMermaid(`${edge.sourceDomain}_${edge.sourceKey}`);
    const targetId = escapeMermaid(`${edge.targetDomain}_${edge.targetKey}`);
    const edgeId = `${sourceId}|${targetId}|${edge.edgeType}`;
    if (edgeSet.has(edgeId)) continue;
    edgeSet.add(edgeId);
    diagramLines.push(`  ${sourceId} -->|${edge.edgeType}| ${targetId}`);
  }

  return diagramLines.join('\n');
}

function buildInterFlowSection(graph: ProjectDependencyGraph): string | null {
  if (graph.flowEdges.length === 0) return null;

  const parts: string[] = [];
  parts.push(heading(2, 'Inter-Flow Dependencies'));

  const mermaid = buildDependencyMermaid(graph);
  if (mermaid) {
    parts.push(`\`\`\`mermaid\n${mermaid}\n\`\`\``);
  }

  // Edge details table
  const seen = new Set<string>();
  const uniqueEdges = graph.flowEdges.filter((e) => {
    const id = `${e.sourceDomain}|${e.sourceKey}|${e.targetDomain}|${e.targetKey}|${e.edgeType}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const rows = uniqueEdges.map((e) => [
    `${inlineCode(e.sourceKey)} (${e.sourceDomain})`,
    `${inlineCode(e.targetKey)} (${e.targetDomain})`,
    e.edgeType,
    e.sourceDomain !== e.targetDomain ? 'Yes' : '-',
  ]);
  parts.push(
    table(['Source Workflow', 'Target Workflow', 'Edge Type', 'Cross-domain'], rows),
  );

  return parts.join('\n\n');
}

function buildWorkflowDetailsSection(graph: ProjectDependencyGraph): string | null {
  if (graph.workflows.length === 0) return null;

  const parts: string[] = [];
  parts.push(heading(2, 'Workflow Dependency Details'));

  const rows = graph.workflows
    .sort((a, b) => a.workflowKey.localeCompare(b.workflowKey))
    .map((w) => {
      const crossDomainRefs = w.refs.filter((r) => r.crossDomain);
      const externalDomains = [...new Set(crossDomainRefs.map((r) => r.domain))].sort();
      return [
        inlineCode(w.workflowKey),
        w.workflowDomain || '-',
        String(w.refs.length),
        String(crossDomainRefs.length),
        externalDomains.length
          ? externalDomains.map((d) => inlineCode(d)).join(', ')
          : '-',
      ];
    });

  parts.push(
    table(
      ['Workflow', 'Domain', 'Total Dependencies', 'Cross-domain Count', 'External Domains'],
      rows,
    ),
  );

  return parts.join('\n\n');
}

export function generateDependencyTreeMarkdown(
  projectName: string,
  graph: ProjectDependencyGraph,
): string {
  const sections: (string | null | undefined | false)[] = [];

  sections.push(heading(1, `${projectName} - Dependency Tree`));
  sections.push(
    'This document provides a dependency analysis across all workflows in the project, ' +
    'including cross-domain usage and inter-flow relationships.',
  );

  sections.push(buildOverviewSection(graph));

  const hasCrossDomain = graph.workflows.some((w) =>
    w.refs.some((r) => r.crossDomain),
  );
  if (hasCrossDomain) {
    sections.push(buildCrossDomainSection(graph));
  } else {
    sections.push(heading(2, 'Cross-Domain Dependencies'));
    sections.push(callout('No Cross-Domain Dependencies', 'All workflow references are within the same domain.'));
  }

  sections.push(buildInterFlowSection(graph));
  sections.push(buildWorkflowDetailsSection(graph));

  sections.push('\n---\n*Generated by vNext Forge*');

  return lines(...sections);
}
