import * as net from 'node:net';

const PREFERRED_PORT = 18920;

/**
 * Tries to bind the preferred port first so the browser origin stays stable
 * across launches (preserving localStorage). Falls back to an OS-assigned
 * ephemeral port when the preferred one is already in use.
 */
export function findFreePort(): Promise<number> {
  return tryPort(PREFERRED_PORT).catch(() => tryPort(0));
}

function tryPort(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
  });
}
