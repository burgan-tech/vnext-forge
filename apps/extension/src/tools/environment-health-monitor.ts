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
   * status bar. If healthy, stops any pending retries. If unhealthy,
   * starts the retry cycle from scratch.
   */
  async checkNow(): Promise<HealthStatus> {
    if (!this.currentEnv) return 'unknown';
    this.stopRetrying();
    this.retryCount = 0;
    this.setHealth('checking');
    const status = await this.performCheck(this.currentEnv.baseUrl);
    this.setHealth(status);

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
      try {
        const url = new URL('/healthy', baseUrl);
        const requester = url.protocol === 'https:' ? https : http;

        const req = requester.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
          const isOk = res.statusCode != null && res.statusCode >= 200 && res.statusCode < 300;
          res.resume();
          res.on('end', () => {
            resolve(isOk ? 'healthy' : 'unhealthy');
          });
        });

        req.on('error', (err) => {
          baseLogger.info({ url: url.toString(), error: err.message }, 'Health check failed');
          resolve('unhealthy');
        });

        req.on('timeout', () => {
          req.destroy();
          resolve('unhealthy');
        });
      } catch (err) {
        baseLogger.warn({ baseUrl, error: (err as Error).message }, 'Invalid health check URL');
        resolve('unhealthy');
      }
    });
  }
}
