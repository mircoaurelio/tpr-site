import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep TPR's login separate from any personal Cloudflare credentials.
const base = process.platform === 'win32'
  ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  : path.join(os.homedir(), '.config');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, XDG_CONFIG_HOME: path.join(base, 'tpr-cloudflare'), WRANGLER_SEND_METRICS: 'false' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
