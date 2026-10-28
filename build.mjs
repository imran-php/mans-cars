import { mkdir, copyFile, cp } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'tokens.css', 'base.css', 'app.js', 'availability.js', 'admin.html', 'admin.css', 'robots.txt']) {
  await copyFile(file, `dist/${file}`);
}
await cp('assets', 'dist/assets', { recursive: true });
await build({ entryPoints: ['admin.js'], bundle: true, format: 'esm', outfile: 'dist/admin.js', minify: true });
