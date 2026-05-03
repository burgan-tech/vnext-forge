import * as http from 'node:http';
import { utilityProcess, type UtilityProcess } from 'electron';

const HEALTH_POLL_INTERVAL_MS = 250;
const HEALTH_POLL_TIMEOUT_MS = 30_000;

interface ServerRunnerOptions {
  port: number;
  webviewDir: string;
  serverBundlePath: string;
}

interface RunningServer {
  process: UtilityProcess;
  port: number;
  kill: () => void;
}

function pollHealth(port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function attempt() {
      if (Date.now() > deadline) {
        reject(new Error(`Server did not become healthy within ${timeoutMs}ms`));
        return;
      }

      const req = http.get(
        { hostname: '127.0.0.1', port, path: '/api/health', timeout: 2000 },
        (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            setTimeout(attempt, HEALTH_POLL_INTERVAL_MS);
          }
          res.resume();
        },
      );

      req.on('error', () => setTimeout(attempt, HEALTH_POLL_INTERVAL_MS));
      req.on('timeout', () => {
        req.destroy();
        setTimeout(attempt, HEALTH_POLL_INTERVAL_MS);
      });
    }

    attempt();
  });
}

export async function startServer(options: ServerRunnerOptions): Promise<RunningServer> {
  const { port, webviewDir, serverBundlePath } = options;

  // utilityProcess.fork() runs the script inside Electron's Node.js runtime —
  // no separate Node.js binary required. The server bundle is CJS and uses only
  // standard Node.js APIs so it runs cleanly in this context.
  const child = utilityProcess.fork(serverBundlePath, [], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      DESKTOP_STATIC_DIR: webviewDir,
    },
  });

  child.stdout?.on('data', (chunk: Buffer) =>
    process.stdout.write(`[server] ${chunk}`),
  );
  child.stderr?.on('data', (chunk: Buffer) =>
    process.stderr.write(`[server] ${chunk}`),
  );

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[desktop] server exited with code ${code}`);
    }
  });

  await pollHealth(port, HEALTH_POLL_TIMEOUT_MS);

  return {
    process: child,
    port,
    kill() {
      child.kill();
    },
  };
}
