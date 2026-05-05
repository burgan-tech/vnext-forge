import * as vscode from 'vscode';
import * as http from 'node:http';
import * as https from 'node:https';
import type { ForgeToolsSettingsService, RuntimeEnvironment } from './forge-tools-settings.js';
import { baseLogger } from '../shared/logger.js';

export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown' | 'checking';

const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_INTERVAL_MS = 5_000;
const MAX_RETRY_ATTEMPTS = 10;

export class EnvironmentHealthMonitor implements vscode.Disposable {
  private readonly _onDidChangeHealth = new vscode.EventEmitter<HealthStatus>();
  readonly onDidChangeHealth = this._onDidChangeHealth.event;

  private readonly envChangeSubscription: vscode.Disposable;
  private health: HealthStatus = 'unknown';
  private runtimeVersion: string | null = null;
  private runtimeDomain: string | null = null;
  private currentEnv: RuntimeEnvironment | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryCount = 0;
  private disposed = false;

  constructor(private readonly settingsService: ForgeToolsSettingsService) {
    this.envChangeSubscription = settingsService.onDidChangeEnvironments(() => {
      void this.syncActiveEnvironment();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.stopRetrying();
    this.envChangeSubscription.dispose();
    this._onDidChangeHealth.dispose();
  }

  getHealth(): HealthStatus {
    return this.health;
  }

  getRuntimeVersion(): string | null {
    return this.runtimeVersion;
  }

  getRuntimeDomain(): string | null {
    return this.runtimeDomain;
  }

  getCurrentEnvironment(): RuntimeEnvironment | null {
    return this.currentEnv;
  }

  async syncActiveEnvironment(): Promise<void> {
    const env = await this.settingsService.getActiveEnvironment();
    if (env?.id !== this.currentEnv?.id || env?.baseUrl !== this.currentEnv?.baseUrl) {
      this.switchEnvironment(env);
    }
  }

  switchEnvironment(env: RuntimeEnvironment | null): void {
    this.stopRetrying();
    this.currentEnv = env;
    this.retryCount = 0;

    if (!env) {
      this.setHealth('unknown');
      return;
    }

    this.setHealth('checking');
    void this.attemptCheck();
  }

  /**
   * Perform a single on-demand health check. Updates shared state and
   * status bar. Always fires the change event so subscribers (like the
   * status bar) re-read the latest value even if the status was the same.
   */
  async checkNow(): Promise<HealthStatus> {
    if (!this.currentEnv) return 'unknown';
    this.stopRetrying();
    this.retryCount = 0;
    this.setHealth('checking');
    const status = await this.performCheck(this.currentEnv.baseUrl);
    this.health = status;
    this._onDidChangeHealth.fire(status);

    if (status !== 'healthy') {
      this.scheduleRetry();
    }

    return status;
  }

  private async attemptCheck(): Promise<void> {
    if (this.disposed || !this.currentEnv) return;

    const status = await this.performCheck(this.currentEnv.baseUrl);
    this.setHealth(status);

    if (status === 'healthy') {
      return;
    }

    this.retryCount++;

    if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
      baseLogger.info(
        { env: this.currentEnv.name, retries: this.retryCount },
        'Health check: max retries reached, stopping',
      );
      return;
    }

    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.disposed) return;
    this.timer = setTimeout(() => void this.attemptCheck(), RETRY_INTERVAL_MS);
  }

  private stopRetrying(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private setHealth(status: HealthStatus): void {
    if (this.health !== status) {
      this.health = status;
      this._onDidChangeHealth.fire(status);
    }
  }

  private performCheck(baseUrl: string): Promise<HealthStatus> {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (status: HealthStatus) => {
        if (resolved) return;
        resolved = true;
        resolve(status);
      };

      try {
        const url = new URL('/health', baseUrl);
        const requester = url.protocol === 'https:' ? https : http;

        const req = requester.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
          const isOk = res.statusCode != null && res.statusCode >= 200 && res.statusCode < 300;
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => { chunks.push(chunk); });
          res.on('end', () => {
            if (!isOk) { done('unhealthy'); return; }

            try {
              const body = Buffer.concat(chunks).toString('utf-8');
              const parsed = JSON.parse(body) as { status?: string; version?: string; domain?: string };
              if (parsed.version) this.runtimeVersion = parsed.version;
              if (parsed.domain) this.runtimeDomain = parsed.domain;
              const isHealthy = parsed.status === 'Healthy' || parsed.status === 'healthy';
              done(isHealthy ? 'healthy' : 'unhealthy');
            } catch {
              done('healthy');
            }
          });
          res.on('error', () => done('unhealthy'));
          res.on('aborted', () => done('unhealthy'));
        });

        req.on('error', (err) => {
          baseLogger.info({ url: url.toString(), error: err.message }, 'Health check failed');
          done('unhealthy');
        });

        req.on('timeout', () => {
          req.destroy();
          done('unhealthy');
        });
      } catch (err) {
        baseLogger.warn({ baseUrl, error: (err as Error).message }, 'Invalid health check URL');
        done('unhealthy');
      }
    });
  }
}
