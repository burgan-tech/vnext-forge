import * as path from 'path';
import * as vscode from 'vscode';
import {
  generateWorkflowMarkdown,
  generateTaskMarkdown,
  generateFunctionMarkdown,
  generateExtensionMarkdown,
  generateSchemaMarkdown,
  generateViewMarkdown,
  generateIndexMarkdown,
  generateDependencyTreeMarkdown,
  extractWorkflowDependencies,
  extractTaskWorkflowTriggers,
  aggregateProjectGraph,
  resolveLabelOrKey,
  type ComponentDocEntry,
  type IndexExtraLink,
  type WorkflowDependencyReport,
  type FlowEdge,
} from '@vnext-forge-studio/doc-gen';

type ComponentCategory = 'workflows' | 'tasks' | 'functions' | 'extensions' | 'schemas' | 'views';

const CATEGORY_FOLDERS: Record<ComponentCategory, string> = {
  workflows: 'Workflows',
  tasks: 'Tasks',
  functions: 'Functions',
  extensions: 'Extensions',
  schemas: 'Schemas',
  views: 'Views',
};

const GENERATORS: Record<ComponentCategory, (json: unknown) => string> = {
  workflows: generateWorkflowMarkdown,
  tasks: generateTaskMarkdown,
  functions: generateFunctionMarkdown,
  extensions: generateExtensionMarkdown,
  schemas: generateSchemaMarkdown,
  views: generateViewMarkdown,
};

const SAFE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function sanitizeKey(key: string): string | null {
  const base = path.basename(key).replace(/\.md$/i, '');
  if (!base || !SAFE_FILENAME_RE.test(base)) return null;
  return base;
}

interface DiscoveredFile {
  uri: vscode.Uri;
  category: ComponentCategory;
}

async function discoverComponentFiles(projectRoot: string): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = [];

  for (const [category, folder] of Object.entries(CATEGORY_FOLDERS) as [ComponentCategory, string][]) {
    const pattern = new vscode.RelativePattern(projectRoot, `**/${folder}/**/*.json`);
    const found = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 500);
    for (const uri of found) {
      const basename = path.basename(uri.fsPath);
      if (basename === 'vnext.config.json' || basename === 'package.json' || basename === 'tsconfig.json') {
        continue;
      }
      files.push({ uri, category });
    }
  }

  return files;
}

async function readJsonFile(uri: vscode.Uri): Promise<unknown | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(bytes).toString('utf-8'));
  } catch {
    return null;
  }
}

function resolveComponentLabel(json: unknown, category: ComponentCategory): string {
  const obj = json as Record<string, unknown> | null;
  if (!obj) return 'Unknown';

  const attrs = obj.attributes as Record<string, unknown> | undefined;
  const labels = attrs?.labels as { language: string; label: string }[] | undefined;
  const key = String(obj.key ?? 'Unknown');
  return resolveLabelOrKey(labels, key);
}

export async function generateProjectDocumentation(projectRoot: string): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Generating documentation',
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ message: 'Scanning components...' });

      const files = await discoverComponentFiles(projectRoot);

      if (files.length === 0) {
        void vscode.window.showWarningMessage('No vNext components found in the project.');
        return;
      }

      if (token.isCancellationRequested) return;

      const docsRoot = path.join(projectRoot, 'docs');
      const docsUri = vscode.Uri.file(docsRoot);
      try {
        await vscode.workspace.fs.createDirectory(docsUri);
      } catch {
        // directory may already exist
      }

      const indexEntries: ComponentDocEntry[] = [];
      const skipped: string[] = [];
      const depReports: WorkflowDependencyReport[] = [];
      const taskEdges: FlowEdge[] = [];
      let processed = 0;
      let written = 0;

      for (const file of files) {
        if (token.isCancellationRequested) return;

        processed++;
        progress.report({
          message: `Processing ${processed}/${files.length}...`,
          increment: (1 / files.length) * 100,
        });

        const json = await readJsonFile(file.uri);
        if (!json) {
          skipped.push(`${vscode.workspace.asRelativePath(file.uri)}: failed to parse JSON`);
          continue;
        }

        const generator = GENERATORS[file.category];
        if (!generator) continue;

        let markdown: string;
        try {
          markdown = generator(json);
        } catch (err) {
          skipped.push(`${vscode.workspace.asRelativePath(file.uri)}: generation error — ${err instanceof Error ? err.message : String(err)}`);
          continue;
        }

        if (file.category === 'workflows') {
          depReports.push(extractWorkflowDependencies(json));
        } else if (file.category === 'tasks') {
          const edge = extractTaskWorkflowTriggers(json);
          if (edge) taskEdges.push(edge);
        }

        const obj = json as Record<string, unknown>;
        const rawKey = String(obj.key ?? path.basename(file.uri.fsPath, '.json'));
        const key = sanitizeKey(rawKey);
        if (!key) {
          skipped.push(`${vscode.workspace.asRelativePath(file.uri)}: unsafe key "${rawKey}"`);
          continue;
        }

        const categoryDir = path.join(docsRoot, file.category);
        const categoryUri = vscode.Uri.file(categoryDir);
        try {
          await vscode.workspace.fs.createDirectory(categoryUri);
        } catch {
          // directory may already exist
        }

        const resolved = path.resolve(categoryDir, `${key}.md`);
        if (!resolved.startsWith(path.resolve(docsRoot) + path.sep)) {
          skipped.push(`${vscode.workspace.asRelativePath(file.uri)}: path escape detected`);
          continue;
        }

        const mdUri = vscode.Uri.file(resolved);
        await vscode.workspace.fs.writeFile(mdUri, Buffer.from(markdown, 'utf-8'));
        written++;

        const label = resolveComponentLabel(json, file.category);
        indexEntries.push({
          key,
          category: file.category,
          label,
          description: String((obj as Record<string, unknown>)._comment ?? ''),
          relativePath: `./${file.category}/${key}.md`,
        });
      }

      if (token.isCancellationRequested) return;

      const projectName = path.basename(projectRoot);
      const extraLinks: IndexExtraLink[] = [
        {
          label: 'Dependency Tree',
          relativePath: './dependency-tree.md',
          description: 'Cross-domain dependencies and inter-flow relationships',
        },
      ];
      const indexMarkdown = generateIndexMarkdown(indexEntries, projectName, extraLinks);
      const indexUri = vscode.Uri.file(path.join(docsRoot, 'index.md'));
      await vscode.workspace.fs.writeFile(indexUri, Buffer.from(indexMarkdown, 'utf-8'));
      written++;

      // Task-trigger edges have empty sourceKey because the task JSON doesn't
      // know which workflow invokes it. Match each edge to workflows that
      // reference the triggering task by key, falling back to domain match.
      for (const edge of taskEdges) {
        if (edge.sourceKey !== '') continue;
        for (const report of depReports) {
          const usesTask = report.refs.some(
            (r) => r.kind === 'task' && r.key === edge.sourceKey,
          );
          if (usesTask || report.workflowDomain === edge.sourceDomain) {
            edge.sourceKey = report.workflowKey;
            break;
          }
        }
      }

      const graph = aggregateProjectGraph(depReports, taskEdges);
      const depTreeMarkdown = generateDependencyTreeMarkdown(projectName, graph);
      const depTreeUri = vscode.Uri.file(path.join(docsRoot, 'dependency-tree.md'));
      await vscode.workspace.fs.writeFile(depTreeUri, Buffer.from(depTreeMarkdown, 'utf-8'));
      written++;

      const msg = `Documentation generated: ${written} files written to docs/`;
      if (skipped.length > 0) {
        void vscode.window.showWarningMessage(
          `${msg} (${skipped.length} skipped — see Output for details)`,
        );
      } else {
        void vscode.window.showInformationMessage(msg);
      }
    },
  );
}
