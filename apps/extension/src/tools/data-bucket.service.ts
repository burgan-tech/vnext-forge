import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type * as vscode from 'vscode';

export interface TransitionBucketEntry {
  key: string;
  headers: Record<string, string>;
  queryStrings: Record<string, unknown>;
  body: {
    key?: string;
    tags?: string[];
    attributes: Record<string, unknown>;
  };
}

export interface WorkflowBucketConfig {
  key: string;
  globalHeaders: Record<string, string>;
  start: {
    headers: Record<string, string>;
    queryStrings: { sync?: boolean; version?: string };
    body: {
      key?: string;
      tags?: string[];
      attributes: Record<string, unknown>;
    };
  };
  transitions: TransitionBucketEntry[];
}

export class DataBucketService {
  private readonly baseDir: string;

  constructor(globalStorageUri: vscode.Uri) {
    this.baseDir = path.join(globalStorageUri.fsPath, 'data-buckets');
  }

  async saveConfig(domain: string, workflowKey: string, config: WorkflowBucketConfig): Promise<void> {
    const dir = path.join(this.baseDir, sanitizeFileName(domain));
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, `${sanitizeFileName(workflowKey)}.json`);
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
  }

  async loadConfig(domain: string, workflowKey: string): Promise<WorkflowBucketConfig | null> {
    const filePath = path.join(this.baseDir, sanitizeFileName(domain), `${sanitizeFileName(workflowKey)}.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as WorkflowBucketConfig;
    } catch {
      return null;
    }
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}
