const path = require('node:path');
const { spawn } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const preferredPort = Number(process.env.VITE_DEV_SERVER_PORT ?? process.env.PORT ?? 5173);
const tscBin = require.resolve('typescript/bin/tsc', { paths: [appRoot] });

const children = new Set();
let shuttingDown = false;
let viteServer;

function prefixOutput(stream, prefix, write) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    for (const line of chunk.split(/\r?\n/)) {
      if (line.length > 0) {
        write(`[${prefix}] ${line}\n`);
      }
    }
  });
}

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: appRoot,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  children.add(child);
  prefixOutput(child.stdout, options.name ?? command, process.stdout.write.bind(process.stdout));
  prefixOutput(child.stderr, options.name ?? command, process.stderr.write.bind(process.stderr));
  child.on('exit', () => children.delete(child));

  return child;
}

function runOnce(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(command, args, options);

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${options.name ?? command} exited with ${signal ?? `code ${code}`}`));
    });
  });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    child.kill();
  }

  if (viteServer) {
    await viteServer.close();
  }

  process.exit(exitCode);
}

function normalizeUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function start() {
  const { createServer } = await import('vite');

  await runOnce(process.execPath, [tscBin, '--project', 'tsconfig.electron.json'], { name: 'electron:build' });

  viteServer = await createServer({
    root: appRoot,
    configFile: path.join(appRoot, 'vite.config.ts'),
    server: {
      host: '127.0.0.1',
      port: preferredPort,
      strictPort: false,
    },
  });

  await viteServer.listen();
  viteServer.printUrls();

  const localUrls = viteServer.resolvedUrls?.local ?? [];
  const devServerUrl = normalizeUrl(localUrls[0] ?? `http://127.0.0.1:${viteServer.config.server.port}`);

  console.log(`[dev] Electron renderer URL: ${devServerUrl}`);

  const electronWatch = spawnChild(
    process.execPath,
    [tscBin, '--project', 'tsconfig.electron.json', '--watch'],
    { name: 'electron:watch' },
  );
  const electronBinary = require(require.resolve('electron', { paths: [appRoot] }));
  const electronApp = spawnChild(electronBinary, ['.'], {
    name: 'electron',
    env: {
      VITE_DEV_SERVER_URL: devServerUrl,
      ELECTRON_RENDERER_URL: devServerUrl,
    },
  });

  electronWatch.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      void shutdown(code ?? 1);
    }
  });

  electronApp.on('exit', (code) => {
    if (!shuttingDown) {
      void shutdown(code ?? 0);
    }
  });
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

start().catch((error) => {
  console.error(error);
  void shutdown(1);
});
