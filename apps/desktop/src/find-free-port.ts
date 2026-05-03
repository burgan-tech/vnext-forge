import * as net from 'node:net';

/** Asks the OS for an available TCP port on the loopback interface. */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unexpected server address format'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}
